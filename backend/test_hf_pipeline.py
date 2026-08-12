import os
os.environ["SILENT_CO_DRIVER_DEMO_MODE"] = "0"
os.environ["HF_HOME"] = "/tmp/huggingface"
import librosa
from app.models.whisper import load_whisper
from app.models.emotion import load_emotion
import traceback

def test():
    try:
        print("Loading audio...")
        audio, sr = librosa.load("../test_audio/calm_radio.mp3", sr=16000, mono=True)
        
        print("Loading Whisper...")
        w_pipe = load_whisper(-1)
        print("Whisper running...")
        try:
            res = w_pipe({"array": audio, "sampling_rate": 16000})
            print("Whisper result:", res)
        except Exception as e:
            print("WHISPER EXCEPTION:")
            traceback.print_exc()

        print("Loading Emotion...")
        e_pipe = load_emotion(-1)
        print("Emotion running...")
        try:
            res = e_pipe({"array": audio, "sampling_rate": 16000})
            print("Emotion result:", res)
        except Exception as e:
            print("EMOTION EXCEPTION:")
            traceback.print_exc()

    except Exception as e:
        traceback.print_exc()

test()
