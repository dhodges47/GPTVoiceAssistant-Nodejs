import OpenAI from 'openai';
import { Router } from 'express';

import path from 'path';
import { fileURLToPath } from 'url';
import { recordAudio } from './recordAudio.js';
// we are using the promises version of the filesystem library for reading and writing files
// use the regular version for streams
import { promises as fsPromises } from 'fs';
import fs from 'fs';

import { spawn } from 'child_process';
import readline from 'node:readline';
import dt from 'date-and-time';
import { stdin, stdout } from 'process';

import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY, // defaults to process.env["OPENAI_API_KEY"]
});


const rl = readline.createInterface({
    input: stdin,
    output: stdout
});


// Enable raw input and keypress events
function mainLoop() {
    rl.question("Type 'n' to make a new assistant session. Press 'Enter' to choose an existing assistant session.", (userChoice) => {
        if (userChoice === 'n') {
            rl.question("Please type a name for this chat session: ", (userNameInput) => {
                const voiceNames = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
                console.log("Voice List:\n1. Alloy - Androgynous, Neutral\n2. Echo - Male, Neutral\n3. Fable - Male, British Accent\n4. Onyx - Male, Deep\n5. Nova - Female, Neutral\n6. Shimmer - Female, Deep");
                rl.question("Please type the number of the voice you want: ", async (assistantNumber) => {
                    const voiceIndex = parseInt(assistantNumber) - 1;
                    const assistantVoice = voiceNames[voiceIndex];
                    const { assistantId, threadId } = await setupAssistant(openai, userNameInput);
                    await saveSession(assistantId, threadId, userNameInput, assistantVoice);
                    if (assistantId && threadId) {
                        console.log(`Created Session with ${userNameInput}, Assistant ID: ${assistantId} and Thread ID: ${threadId}`);
                        handleSession(assistantId, threadId, userNameInput, assistantVoice);
                    }
                });
            });
        } else {
            displaySessions();
            rl.question("Enter the session number to load: ", async (chosenSessionNumber) => {
                let sessionData = await getSessionsData(chosenSessionNumber);
                if (sessionData) {
                    const { assistantId, threadId, userNameInput, assistantVoice } = sessionData;
                    if (assistantId && threadId) {
                        //console.log(`Loaded Session ${chosenSessionNumber} with Assistant ID: ${assistantId} and Thread ID: ${threadId}`);
                        handleSession(assistantId, threadId, userNameInput, assistantVoice);
                    }
                } else {
                    console.log("No session data found");
                }

            });
        }
    });
}

function handleSession(assistantId, threadId, userNameInput, assistantVoice) {
    // Make `process.stdin` begin emitting "keypress" events

    let firstIteration = true;
    let transcription = '';
    const sessionLoop = async () => {
        while (true) {
            if (firstIteration) {
                console.log("Press Page Down to start recording your voice message, and Page Up to stop recording:");
               transcription = await whisper();
                console.log(`You said: ${transcription}`);
                firstIteration = false;
            } else {
                transcription = await whisper();
                console.log(`You said: ${transcription}`);
            }
            if (transcription.toLowerCase() === 'exit') {
                console.log(collectMessageHistory(threadId, userNameInput));
                return;
            }
            sendMessage(openai, threadId, transcription);
            const messageDict = await runAssistant(openai, assistantId, threadId);
            const mostRecentMessage = messageDict['data'][0];
            const assistantMessage = mostRecentMessage['content'][0]['text']['value'];
            console.log('Sending response to voice');
            voiceStream(assistantMessage, assistantVoice);
        }
    };
    sessionLoop();
}
async function setupAssistant() {
    const myAssistant = await openai.beta.assistants.create({

        instructions:
            `
    You are a friend. Your name is {assistant_name}. You are having a 
    vocal conversation with a user. You will never output any markdown 
    or formatted text of any kind, and you will speak in a concise, 
    highly conversational manner. You will adopt any persona that the 
    user may ask of you.
    `,
        name: "Vocal Friend",
        tools: [{ type: "code_interpreter" }],
        model: "gpt-4-1106-preview",

    });
    const myThread = await openai.beta.threads.create();
    const assistantId = myAssistant.id;
    const threadId = myThread.id;
    return { assistantId, threadId };
}
async function sendMessage(openai, threadId, task) {
    //This function sends your voice message into the thread object, which then gets passed to the AI.

    const threadMessage = await openai.beta.threads.messages.create(
        threadId,
        { role: "user", content: task }
    );
    return threadMessage;
}
async function runAssistant(openai, assistant_id, thread_id) {
    // Runs the assistant with the given thread and assistant IDs.

    let run = await openai.beta.threads.runs.create(
        thread_id,
        { assistant_id: assistant_id }
    );
    while (run.status === "in_progress" || run.status === "queued") {
        // Wait for 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('waiting');
        run = await openai.beta.threads.runs.retrieve(
            thread_id,
            run.id
        );

        if (run.status === "completed") {
            console.log('Response received');
            return await openai.beta.threads.messages.list(
                thread_id
            );
        }
    }
}

async function saveSession(assistant_id, thread_id, user_name_input, assistant_voice, filePath = 'chat_sessions.json') {
    let sessionData = { "sessions": {} };
    // This function saves your session data locally, so you can easily retrieve it from the JSON file at any time.
    try {
        const fileData = await fsPromises.readFile(filePath, 'utf8');
        sessionData = JSON.parse(fileData);
        //console.log('sessionData from file', sessionData);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.log(`${filePath} does not exist, creating a new sessionData.`);
        } else {
            console.error('Error reading/parsing the file:', err);
        }
    }

    // Find the next session number
    const numberOfSessions = Object.keys(sessionData.sessions).length;
    let next_session_number = String(numberOfSessions + 1);
    // Add the new session
    sessionData["sessions"][next_session_number] = {
        "Assistant ID": assistant_id,
        "Thread ID": thread_id,
        "User Name Input": user_name_input,
        "Assistant Voice": assistant_voice
    }

    // Save data back to file
    await fsPromises.writeFile(filePath, JSON.stringify(sessionData, null, 4), 'utf8');

}
async function displaySessions(filePath = 'chat_sessions.json') {
    // This function shows your available sessions when you request it.
    const data = await fsPromises.readFile(filePath, 'utf8');

    try {
        const jsonData = JSON.parse(data);
        console.log("Available Sessions:");
        for (const [number, session] of Object.entries(jsonData["sessions"])) {
            console.log(`Session ${number}: ${session['User Name Input']}`);
        }
    } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
    }

}
async function getSessionsData(sessionNumber, filePath = 'chat_sessions.json') {
    // This function retrieves the session that you choose.
    try {
        const data = await fsPromises.readFile(filePath, 'utf8');
        try {
            const jsonData = JSON.parse(data);
            const session = jsonData["sessions"][sessionNumber];

            if (session) {
                return {
                    assistantId: session["Assistant ID"],
                    threadId: session["Thread ID"],
                    userNameInput: session["User Name Input"],
                    assistantVoice: session["Assistant Voice"]
                };
            } else {
                console.log("Session not found.");
                return null;
            }
        } catch (parseErr) {
            console.error('Error parsing JSON:', parseErr);
        }
    } catch (fileError) {
        console.error('Error reading file:', fileError);

    }
}

async function collectMessageHistory(threadId, userNameInput) {
    // This function downloads and writes your entire chat history to a text file, so you can keep your own records.

    // Assuming `retrieveMessages` is a function that asynchronously gets your messages
    // and returns a JSON string similar to Python's `messages.model_dump_json()`
    try {
        const messagesJson = openai.beta.threads.messages.list(thread_id)
        const messageDict = JSON.parse(messagesJson);

        const filePath = `${userNameInput}_message_log.txt`;
        const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

        messageDict['data'].reverse().forEach(message => {
            // Extracting the text value from the message
            const textValue = message['content'][0]['text']['value'];

            // Adding a prefix to distinguish between user and assistant messages
            const prefix = message['role'] === 'assistant' ? `${userNameInput}: ` : "You: ";

            // Writing the prefixed message to the log
            stream.write(prefix + textValue + '\n');
        });

        stream.end();
        return `Messages saved to ${filePath}`;
    } catch (error) {
        console.error('Error:', error);
        return `Failed to save messages`;
    }
}
async function whisper() {
    await recordAudio();

    try {
        const transcript = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: fs.createReadStream("user_response.wav"),
        });
        return (transcript.text)

    } catch (error) {
        console.log(error)
    };
  
}

async function voiceStream(inputText, assistantVoice) {

    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: assistantVoice,
            input: inputText
        });

        // Ensure the ffplay command is set up to read from stdin
        const ffplayProc = spawn('ffplay', ['-nodisp', '-autoexit', '-']);

        // Stream the audio to ffplay
        const buffer = Buffer.from(await mp3.arrayBuffer());
        ffplayProc.stdin.write(buffer);
        ffplayProc.stdin.end();

        ffplayProc.on('close', (code) => {
            console.log(`ffplay process exited with code ${code}`);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}
mainLoop();