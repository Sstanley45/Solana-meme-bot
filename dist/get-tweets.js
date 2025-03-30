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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTweets = getTweets;
const axios_1 = __importDefault(require("axios"));
const TWEET_MAX_TIME_MS = 2 * 60 * 60 * 1000;
function getTweets(userName) {
    return __awaiter(this, void 0, void 0, function* () {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://twitter241.p.rapidapi.com/user-tweets?user=${userName}&count=20`,
            headers: {
                'x-rapidapi-host': 'twitter241.p.rapidapi.com',
                'x-rapidapi-key': process.env.RAPID_API_KEY
            }
        };
        const response = yield axios_1.default.request(config);
        const timelineResponse = response.data.result.timeline.instructions.filter((x) => x.type === "TimelineAddEntries");
        const tweets = [];
        timelineResponse[0].entries.map((x) => {
            if (x.content.itemContent) {
                // console.log("x", x.content.itemContent.tweet_results.result.legacy.full_text);
                // console.log("x", x.content.itemContent.tweet_results.result.legacy.created_at);
                // console.log("x", x.content.itemContent.tweet_results.result.legacy.id_str);
                try {
                    tweets.push({
                        contents: x.content.itemContent.tweet_results.result.legacy.full_text,
                        id: x.content.itemContent.tweet_results.result.legacy.id_str,
                        createdAt: x.content.itemContent.tweet_results.result.legacy.created_at
                    });
                }
                catch (e) {
                }
            }
        });
        return tweets.filter(x => new Date(x.createdAt).getTime() > Date.now() - TWEET_MAX_TIME_MS);
        // return tweets
    });
}
