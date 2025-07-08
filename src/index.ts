require('dotenv').config();
import { getTokenFromLLM } from "./get-token-from-llm";
import { getTweets } from "./get-tweets";
import { LAMPORTS_PER_SOL, Connection, PublicKey } from "@solana/web3.js";
import { swap } from "./swap";
import { sendEmailNotification } from './email-service';

// Configuration
const SOL_AMOUNT = 0.001 * LAMPORTS_PER_SOL;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const connection = new Connection(process.env.RPC_URL!);
const TWEET_FETCH_INTERVAL_MS = 5 * 60 * 1000; 

const MONITORED_USERS = [
    "1736404903122100225", 
    "285869396",  
    "1354400126857605121"   
];

async function extractTokenAddress(tweetContent: string): Promise<string | null> {
    // First try: Use LLM extraction
    try {
        const llmResult = await getTokenFromLLM(tweetContent);
        if (llmResult && llmResult !== "null") {
            return llmResult;
        }
    } catch (error) {
        console.log('⚠️ LLM extraction failed, trying fallback methods');
    }

    // Fallback 1: Direct address extraction
    const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
    const matches = tweetContent.match(solanaAddressRegex);
    if (matches && matches[0]) {
        try {
            new PublicKey(matches[0]); // Validate
            return matches[0];
        } catch {
            // Invalid address format
        }
    }

    // Fallback 2: Try to find token symbol and map to known addresses
    const tokenSymbolMatch = tweetContent.match(/\$([A-Za-z0-9]+)/);
    if (tokenSymbolMatch) {
        const symbol = tokenSymbolMatch[1];
        console.log(`🔎 Found token symbol: $${symbol}, but no address`);
    }

    return null;
}

async function runBot() {
    console.log(`🤖 Starting Solana bot (checking tweets every ${TWEET_FETCH_INTERVAL_MS/60000} minutes)`);
    
    // Immediate first run
    await executeBotCycle();
    
    // Set up periodic execution
    setInterval(executeBotCycle, TWEET_FETCH_INTERVAL_MS);
}

async function executeBotCycle() {
    console.log(`\n⏰ [${new Date().toISOString()}] Starting new cycle`);
    
    try {
        const allTweets = (await Promise.all(
            MONITORED_USERS.map(user => getTweetsWithRetry(user).catch(e => {
                console.error(`Failed to get tweets for user ${user}:`, e);
                return [];
            }))
        )).flat();

        console.log(`📩 Found ${allTweets.length} tweets to process`);
        
        for (const tweet of allTweets) {
            await processTweet(tweet);
        }
        
        console.log(`✅ Cycle completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error('❌ Bot cycle error:', error);
        await sendEmailNotification({
            to: process.env.EMAIL_RECIPIENT!,
            subject: '⚠️ Bot Cycle Error',
            text: `Error during bot cycle:\n${error instanceof Error ? error.message : String(error)}`
        });
    }
}

async function processTweet(tweet: any) {
    console.log(`\n🔍 Processing tweet: "${tweet.contents.substring(0, 50)}..."`);
    
    try {
        const tokenAddress = await extractTokenAddress(tweet.contents);
        
        if (tokenAddress) {
            console.log(`✅ Extracted token address: ${tokenAddress}`);
            
            if (await validateTokenAddress(tokenAddress)) {
                console.log(`🔄 Attempting swap for ${tokenAddress}`);
                try {
                    await swapWithRetry(tokenAddress, SOL_AMOUNT);
                    await sendEmailNotification({
                        to: process.env.EMAIL_RECIPIENT!,
                        subject: `✅ Swap Executed: ${tokenAddress.substring(0, 8)}...`,
                        text: `Successfully swapped ${SOL_AMOUNT/LAMPORTS_PER_SOL} SOL for token ${tokenAddress}\nFrom tweet: ${tweet.contents.substring(0, 100)}...`,
                    });
                } catch (error) {
                    await sendEmailNotification({
                        to: process.env.EMAIL_RECIPIENT!,
                        subject: `❌ Swap Failed: ${tokenAddress.substring(0, 8)}...`,
                        text: `Failed to swap ${SOL_AMOUNT/LAMPORTS_PER_SOL} SOL for token ${tokenAddress}\nError: ${error instanceof Error ? error.message : String(error)}\nFrom tweet: ${tweet.contents.substring(0, 100)}...`,
                    });
                    throw error;
                }
            } else {
                console.log('⚠️ Invalid token address, skipping swap');
            }
        } else {
            console.log('⏭️ No valid token address found in tweet, skipping');
        }
    } catch (error) {
        console.error('❌ Tweet processing error:', error);
    }
}

async function getTweetsWithRetry(userName: string, attempt = 1): Promise<any[]> {
    try {
        return await getTweets(userName);
    } catch (error) {
        if (attempt >= MAX_RETRIES) throw error;
        console.log(`🔄 Retrying tweet fetch (attempt ${attempt + 1})`);
        await delay(RETRY_DELAY_MS);
        return getTweetsWithRetry(userName, attempt + 1);
    }
}

async function swapWithRetry(tokenAddress: string, amount: number, attempt = 1): Promise<void> {
    try {
        await swap(tokenAddress, amount);
    } catch (error) {
        if (attempt >= MAX_RETRIES) throw error;
        console.log(`🔄 Retrying swap (attempt ${attempt + 1})`);
        await delay(RETRY_DELAY_MS);
        return swapWithRetry(tokenAddress, amount, attempt + 1);
    }
}

async function validateTokenAddress(tokenAddress: string): Promise<boolean> {
    try {
        new PublicKey(tokenAddress);
        const accountInfo = await connection.getAccountInfo(new PublicKey(tokenAddress));
        return accountInfo !== null;
    } catch {
        return false;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the bot
runBot().catch(console.error);