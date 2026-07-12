import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "recorded" | "error";

interface RecorderState {
  status: RecorderStatus;
  blob: Blob | null;
  url: string | null;
  mimeType: string;
  error: string | null;
}

const INITIAL: RecorderState = {
  status: "idle",
  blob: null,
  url: null,
  mimeType: "",
  error: null,
};

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c))
      return c;
  }
  return "";
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>(INITIAL);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const urlRef = useRef<string | null>(null);

  const revokeUrl = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const start = useCallback(async () => {
    revokeUrl();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setState({ status: "recorded", blob, url, mimeType: type, error: null });
      };
      recorderRef.current = recorder;
      recorder.start();
      setState({ ...INITIAL, status: "recording" });
    } catch (err) {
      setState({
        ...INITIAL,
        status: "error",
        error:
          err instanceof Error && err.name === "NotAllowedError"
            ? "Microphone access denied. The Voice Gate requires a mic — allow access and retry."
            : `Could not start recording: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    revokeUrl();
    setState(INITIAL);
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      revokeUrl();
    };
  }, []);

  return { ...state, start, stop, reset };
}
