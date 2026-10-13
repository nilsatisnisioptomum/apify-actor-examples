/**
 * Example: run Broken Link Checker via Apify Client (Node.js)
 * Actor: https://apify.com/chris_elder/broken-link-checker
 *
 * npm i apify-client
 * export APIFY_TOKEN=your_token   # free Apify account token
 * node run.js
 */
import { ApifyClient } from 'apify-client';
import input from './input.example.json' with { type: 'json' };

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('chris_elder/broken-link-checker').call(input);
const { items } = await client.dataset(run.defaultDatasetId).listItems();

console.log('Run:', run.id, run.status);
console.log('Items:', items.length);
console.log(items.slice(0, 3));
