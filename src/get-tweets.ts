import axios from "axios";

const TWEET_MAX_TIME_MS = 2 * 60 * 60 * 1000;

interface Tweet {
    contents: string;
    id: string;
    createdAt: string;
}


export async function getTweets(userName: string): Promise<Tweet[]> {

    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://twitter241.p.rapidapi.com/user-tweets?user=${userName}&count=20`,
        headers: { 
        'x-rapidapi-host': 'twitter241.p.rapidapi.com', 
        'x-rapidapi-key': process.env.RAPID_API_KEY
        }
    };
  
    const response = await axios.request(config)
    const timelineResponse = response.data.result.timeline.instructions.filter((x: any) => x.type === "TimelineAddEntries")

    const tweets: Tweet[] = [];
    
    timelineResponse[0].entries.map((x: any) => {
        if(x.content.itemContent){
            // console.log("x", x.content.itemContent.tweet_results.result.legacy.full_text);
            // console.log("x", x.content.itemContent.tweet_results.result.legacy.created_at);
            // console.log("x", x.content.itemContent.tweet_results.result.legacy.id_str);
            try {
                tweets.push({
                    contents: x.content.itemContent.tweet_results.result.legacy.full_text,
                    id: x.content.itemContent.tweet_results.result.legacy.id_str,
                    createdAt: x.content.itemContent.tweet_results.result.legacy.created_at
                })
            } catch(e) {
    
            }
        }
        
        
    });
    return tweets.filter(x => new Date(x.createdAt).getTime() > Date.now() - TWEET_MAX_TIME_MS);
    // return tweets
}