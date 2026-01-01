import dotenv from 'dotenv';

dotenv.config();

export const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY
};
