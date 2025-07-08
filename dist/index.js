"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const get_token_from_llm_1 = require("./get-token-from-llm");
const get_tweets_1 = require("./get-tweets");
const web3_js_1 = require("@solana/web3.js");
const swap_1 = require("./swap");
const email_service_1 = require("./email-service");
// Configuration
const SOL_AMOUNT = 0.001 * web3_js_1.LAMPORTS_PER_SOL;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const connection = new web3_js_1.Connection(process.env.RPC_URL);
const TWEET_FETCH_INTERVAL_MS = 5 * 60 * 1000;
const MONITORED_USERS = [
    "1736404903122100225",
    "285869396",
    "1354400126857605121"
];
function extractTokenAddress(tweetContent) {
    return __awaiter(this, void 0, void 0, function* () {
        // First try: Use LLM extraction
        try {
            const llmResult = yield (0, get_token_from_llm_1.getTokenFromLLM)(tweetContent);
            if (llmResult && llmResult !== "null") {
                return llmResult;
            }
        }
        catch (error) {
            console.log('⚠️ LLM extraction failed, trying fallback methods');
        }
        // Fallback 1: Direct address extraction
        const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
        const matches = tweetContent.match(solanaAddressRegex);
        if (matches && matches[0]) {
            try {
                new web3_js_1.PublicKey(matches[0]); // Validate
                return matches[0];
            }
            catch (_a) {
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
    });
}
function runBot() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`🤖 Starting Solana bot (checking tweets every ${TWEET_FETCH_INTERVAL_MS / 60000} minutes)`);
        // Immediate first run
        yield executeBotCycle();
        // Set up periodic execution
        setInterval(executeBotCycle, TWEET_FETCH_INTERVAL_MS);
    });
}
function executeBotCycle() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n⏰ [${new Date().toISOString()}] Starting new cycle`);
        try {
            const allTweets = (yield Promise.all(MONITORED_USERS.map(user => getTweetsWithRetry(user).catch(e => {
                console.error(`Failed to get tweets for user ${user}:`, e);
                return [];
            })))).flat();
            console.log(`📩 Found ${allTweets.length} tweets to process`);
            for (const tweet of allTweets) {
                yield processTweet(tweet);
            }
            console.log(`✅ Cycle completed at ${new Date().toISOString()}`);
        }
        catch (error) {
            console.error('❌ Bot cycle error:', error);
            yield (0, email_service_1.sendEmailNotification)({
                to: process.env.EMAIL_RECIPIENT,
                subject: '⚠️ Bot Cycle Error',
                text: `Error during bot cycle:\n${error instanceof Error ? error.message : String(error)}`
            });
        }
    });
}
function processTweet(tweet) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`\n🔍 Processing tweet: "${tweet.contents.substring(0, 50)}..."`);
        try {
            const tokenAddress = yield extractTokenAddress(tweet.contents);
            if (tokenAddress) {
                console.log(`✅ Extracted token address: ${tokenAddress}`);
                if (yield validateTokenAddress(tokenAddress)) {
                    console.log(`🔄 Attempting swap for ${tokenAddress}`);
                    try {
                        yield swapWithRetry(tokenAddress, SOL_AMOUNT);
                        yield (0, email_service_1.sendEmailNotification)({
                            to: process.env.EMAIL_RECIPIENT,
                            subject: `✅ Swap Executed: ${tokenAddress.substring(0, 8)}...`,
                            text: `Successfully swapped ${SOL_AMOUNT / web3_js_1.LAMPORTS_PER_SOL} SOL for token ${tokenAddress}\nFrom tweet: ${tweet.contents.substring(0, 100)}...`,
                        });
                    }
                    catch (error) {
                        yield (0, email_service_1.sendEmailNotification)({
                            to: process.env.EMAIL_RECIPIENT,
                            subject: `❌ Swap Failed: ${tokenAddress.substring(0, 8)}...`,
                            text: `Failed to swap ${SOL_AMOUNT / web3_js_1.LAMPORTS_PER_SOL} SOL for token ${tokenAddress}\nError: ${error instanceof Error ? error.message : String(error)}\nFrom tweet: ${tweet.contents.substring(0, 100)}...`,
                        });
                        throw error;
                    }
                }
                else {
                    console.log('⚠️ Invalid token address, skipping swap');
                }
            }
            else {
                console.log('⏭️ No valid token address found in tweet, skipping');
            }
        }
        catch (error) {
            console.error('❌ Tweet processing error:', error);
        }
    });
}
function getTweetsWithRetry(userName_1) {
    return __awaiter(this, arguments, void 0, function* (userName, attempt = 1) {
        try {
            return yield (0, get_tweets_1.getTweets)(userName);
        }
        catch (error) {
            if (attempt >= MAX_RETRIES)
                throw error;
            console.log(`🔄 Retrying tweet fetch (attempt ${attempt + 1})`);
            yield delay(RETRY_DELAY_MS);
            return getTweetsWithRetry(userName, attempt + 1);
        }
    });
}
function swapWithRetry(tokenAddress_1, amount_1) {
    return __awaiter(this, arguments, void 0, function* (tokenAddress, amount, attempt = 1) {
        try {
            yield (0, swap_1.swap)(tokenAddress, amount);
        }
        catch (error) {
            if (attempt >= MAX_RETRIES)
                throw error;
            console.log(`🔄 Retrying swap (attempt ${attempt + 1})`);
            yield delay(RETRY_DELAY_MS);
            return swapWithRetry(tokenAddress, amount, attempt + 1);
        }
    });
}
function validateTokenAddress(tokenAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            new web3_js_1.PublicKey(tokenAddress);
            const accountInfo = yield connection.getAccountInfo(new web3_js_1.PublicKey(tokenAddress));
            return accountInfo !== null;
        }
        catch (_a) {
            return false;
        }
    });
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Start the bot
runBot().catch(console.error);
