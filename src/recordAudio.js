/**************************************************************
 * Note, for voice recording I am using SoX, version sox-14.4.1
 * The latest release of Sox is 14.4.2 but it doesn't work because it can't find the input device,
 * So I backed off to the previous version and it works fine.
 **************************************************************/
import readline from 'node:readline';
import { stdin, stdout } from 'process';
import recorder from 'node-record-lpcm16';
import fs from 'fs';


readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY)
    process.stdin.setRawMode(true);


let isRecording = false;
let recordingStream = null;  // Add this line to store the stream reference

function startRecording() {
    // Implementation to start the actual recording
    console.log("Recording started");
    isRecording = true;
    const file = fs.createWriteStream('user_response.wav', { encoding: 'binary' });

    recordingStream = recorder.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'wav',
        threshold: 1.0,    // silence threshold (rec only)
        endOnSilence: false  // automatically end on silence (if supported)

    })
        .stream();
    recordingStream.on('error', err => {
        console.error('recorder threw an error:', err)
    })
        .pipe(file);
}
let keypressHandler;
function recordAudio() {
    if (keypressHandler) {
        stdin.off('keypress', keypressHandler);
    }
    return new Promise((resolve, reject) => {
        keypressHandler = (chunk, key) => {
            if (key.name === 'pagedown' && !isRecording) {
                startRecording();
            } else if (key.name === 'pageup' && isRecording) {
                if (recordingStream) {
                    recordingStream.unpipe();
                    recordingStream.end();
                }
                isRecording = false;

                // Clean up by removing the listener
                stdin.off('keypress', keypressHandler);

                resolve('Recording stopped');
            }
        };

        stdin.on('keypress', keypressHandler);
    });
}
export { recordAudio };

