# GPTVoiceAssistant-Nodejs

This is a demo project to have a voice chat with the Assistant.

It is a terminal program, all the action takes place in the command-line.


Converted from the python program here: 

https://github.com/dhodges47/GPTVoiceAssistant


This is the javascript/nodejs script for the article by Jordan Gibbs on Medium: "How to Create Your Own GPT Voice Assistant with Infinite Chat Memory in Python" (thank you Jordan Gibbs!)

https://medium.com/@jordanlgibbs/how-to-create-your-own-gpt-voice-assistant-with-infinite-chat-memory-in-python-d8b8e93f6b21

Read the article to make sure you have all the prerequisites, especially ffmpeg, which takes some setup.
I used SoX for voice recording. 

NOTE 1: Use SoX 14.4.1 for voice recording. The later version, 14.4.2 introduced what seemed to be a bug - it can't find the default microphone.

NOTE 2: this was developed on windows. You might have other requirements or detup issues for ffmpeg or Sox for MacOS or Linux.

## Instructions:
Download the repository into a folder.

Make sure you have the prerequisites for ffmpeg and SoX and that they are in your PATH.

Install the dependencies:

```
npm install
```

Put your OPENAI API key into a copy of env.sample and rename it to .env.

Run the app:
```
node src\GPTVoiceAssistant.js
```
## ToDo
1. Long responses from ChatGPT can be slow. Implement chunking for faster responses.

2. Create a react front end.
