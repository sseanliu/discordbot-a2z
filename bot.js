import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Client, Events, GatewayIntentBits } from "discord.js";
import { OpenAI } from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });


let seanChannel;

let data = JSON.parse(fs.readFileSync("data.json", "utf8"));
let heartCount = data.heartCount;

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ]
});

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Use the environment variable
});

console.log("OpenAI API Key:", process.env.OPENAI_API_KEY.substring(0, 20) + "...");

// When the client is ready, run this code (only once).
client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Ready!! Logged in as ${readyClient.user.tag}`);

    seanChannel = await client.channels.fetch("1293623915138256998");
    //startHeartBeat();
});

// Log in to Discord with your client's token
client.login(process.env.DISCORD_BOT_TOKEN);

let aiMemory = [];

client.on(Events.MessageCreate, async (message) => {
    if (message.channelId !== "1293623915138256998") return;
    if (message.author.bot && message.author.id !== client.user.id) return;

    console.log(message);

    try {
        let messages = [
            { role: "system", content: "You are an AI agent in a Discord chat. You can analyze both text and images, and you have the ability to read your own messages and continue conversations with yourself. Keep your responses concise." },
            ...aiMemory,
            { role: "user", content: message.content }
        ];

        // Check if the message contains an image
        if (message.attachments.size > 0) {
            const attachment = message.attachments.first();
            if (attachment.contentType.startsWith('image/')) {
                messages.push({
                    role: "user",
                    content: [
                        { type: "text", text: "You are my museum tour guide." },
                        {
                            type: "image_url",
                            image_url: {
                                url: attachment.url
                            }
                        }
                    ]
                });
            }
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Use the GPT-4 Vision model
            messages: messages,
            max_tokens: 300
        });

        const reply = response.choices[0].message.content;
        
        // Add the AI's response to memory
        aiMemory.push({ role: "assistant", content: reply });
        if (aiMemory.length > 10) aiMemory.shift(); // Keep memory limited to last 10 messages

        await message.reply(reply);

        // Self-conversation logic
        if (Math.random() < 0.5 && !message.author.bot) { // 50% chance to continue the conversation
            setTimeout(async () => {
                const selfMessage = await message.channel.send("Hmm, let me think about that some more...");
                client.emit(Events.MessageCreate, selfMessage);
            }, 5000); // Wait 5 seconds before sending a follow-up message
        }

        if (message.content.includes("❤️")) {
            message.react("❤️");
        }
    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        message.reply("Sorry, I encountered an error while processing your message.");
    }
});

client.on(Events.MessageReactionAdd, (reaction, user) => {
    console.log(reaction._emoji.name, user);
    if (reaction._emoji.name == "❤️") {
        heartCount++;
        fs.writeFileSync("data.json", JSON.stringify({ heartCount: heartCount }));
        console.log(heartCount);
    }
});

function startHeartBeat() {
    setInterval(() => {
        seanChannel.send(`${heartCount} ❤️`);
    }, 5000);
}
