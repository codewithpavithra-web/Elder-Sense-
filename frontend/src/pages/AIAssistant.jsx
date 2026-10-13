import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Bot,
  HeartPulse,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Pill,
  Send,
  ShieldCheck,
  Sparkles,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function AIAssistant() {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: "Hello! 👋 I’m your Elder Sense Care Assistant. Ask me about medicines, nutrition, symptoms, blood pressure, blood sugar, or elderly care.",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("English");
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [voiceError, setVoiceError] = useState("");

  const recognitionRef = useRef(null);
  const speechRunRef = useRef(0);

  // Supported languages
  // Keep API language names in English (e.g. "Tamil") while showing each
  // language in its native script in the selector. This prevents the backend
  // from receiving "தமிழ்" when it expects the canonical name "Tamil".
  const languages = [
    { name: "English", label: "English", code: "en-IN" },
    { name: "Kannada", label: "ಕನ್ನಡ", code: "kn-IN" },
    { name: "Tamil", label: "தமிழ்", code: "ta-IN" },
    { name: "Hindi", label: "हिन्दी", code: "hi-IN" },
    { name: "Telugu", label: "తెలుగు", code: "te-IN" },
    { name: "Malayalam", label: "മലയാളം", code: "ml-IN" },
  ];

  // Clean escaped Markdown returned by the AI
  const formatAIText = (text) => {
    if (!text) return "";

    let formatted = text;

    // Remove unnecessary backslashes before Markdown characters.
    formatted = formatted.replace(
      /\\([\\`*_{}\[\]()#+\-.!|>~])/g,
      "$1"
    );

    // Convert inline bullet points into proper Markdown list lines.
    formatted = formatted.replace(/\s+-\s+(?=[^\n])/g, "\n- ");

    // Make sure headings begin on a new line.
    formatted = formatted.replace(/\s+(#{1,6}\s)/g, "\n\n$1");

    // Make important sections easier to read.
    formatted = formatted.replace(
      /\s+(\*\*📌[^*]+\*\*)/g,
      "\n\n$1"
    );

    formatted = formatted.replace(
      /\s+(\*\*⚠️[^*]+\*\*)/g,
      "\n\n$1"
    );

    return formatted.trim();
  };

  // Remove Markdown before sending text to speech.
  const cleanTextForSpeech = (text) => {
    if (!text) return "";

    let cleanText = text;

    // Remove code blocks.
    cleanText = cleanText.replace(/```[\s\S]*?```/g, "");

    // Remove Markdown headings.
    cleanText = cleanText.replace(/^#{1,6}\s*/gm, "");

    // Remove bold and italic markers.
    cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, "$1");
    cleanText = cleanText.replace(/\*(.*?)\*/g, "$1");
    cleanText = cleanText.replace(/__(.*?)__/g, "$1");
    cleanText = cleanText.replace(/_(.*?)_/g, "$1");

    // Remove Markdown links but keep their visible text.
    cleanText = cleanText.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Remove table separators.
    cleanText = cleanText.replace(/\|/g, " ");

    // Remove blockquote markers.
    cleanText = cleanText.replace(/^>\s*/gm, "");

    // Remove bullet/list markers.
    cleanText = cleanText.replace(/^\s*[-*+]\s+/gm, "");
    cleanText = cleanText.replace(/^\s*\d+\.\s+/gm, "");

    // Remove repeated spaces/newlines.
    cleanText = cleanText.replace(/\n{2,}/g, ". ");
    cleanText = cleanText.replace(/\s{2,}/g, " ");

    return cleanText.trim();
  };

  // Speak an AI response. Ignore expected "interrupted" events caused by
  // intentionally stopping/replacing an utterance.
  const speakAIResponse = (text, messageIndex) => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      setVoiceError("Voice playback is not supported in this browser. Please use Microsoft Edge or Google Chrome.");
      return;
    }

    setVoiceError("");

    if (speakingIndex === messageIndex && window.speechSynthesis.speaking) {
      speechRunRef.current += 1;
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    // Invalidate callbacks from any previous utterance before cancelling it.
    const runId = ++speechRunRef.current;
    window.speechSynthesis.cancel();
    setSpeakingIndex(null);

    const selectedLanguage = languages.find((item) => item.name === language);
    const speechText = cleanTextForSpeech(text);
    if (!speechText) return;

    const utterance = new SpeechSynthesisUtterance(speechText);
    const langCode = selectedLanguage?.code || "en-IN";
    utterance.lang = langCode;
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Prefer a locally installed voice matching the selected language.
    const chooseVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const exactVoice = voices.find(
        (voice) => voice.lang?.toLowerCase() === langCode.toLowerCase()
      );
      const languageVoice = voices.find(
        (voice) => voice.lang?.toLowerCase().startsWith(langCode.slice(0, 2).toLowerCase())
      );
      const voice = exactVoice || languageVoice;
      if (voice) utterance.voice = voice;
    };
    chooseVoice();

    utterance.onstart = () => {
      if (speechRunRef.current === runId) setSpeakingIndex(messageIndex);
    };
    utterance.onend = () => {
      if (speechRunRef.current === runId) setSpeakingIndex(null);
    };
    utterance.onerror = (event) => {
      // Chrome/Edge emit these when cancel() deliberately stops speech.
      if (event.error === "interrupted" || event.error === "canceled") return;
      if (speechRunRef.current === runId) {
        console.error("Speech synthesis error:", event.error);
        setSpeakingIndex(null);
        setVoiceError("Voice playback could not start. Please try Listen again or check your device audio.");
      }
    };

    // A short delay after cancel() avoids a Chrome/Edge speech queue race.
    window.setTimeout(() => {
      if (speechRunRef.current !== runId) return;
      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        console.error("Unable to start speech playback:", error);
        setSpeakingIndex(null);
        setVoiceError("Unable to play audio. Please try again.");
      }
    }, 120);
  };

  const askAI = async (text = question) => {
    const userQuestion = text.trim();

    if (!userQuestion || loading) {
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login");
      return;
    }

    // Stop any currently playing voice when a new question is asked.
    if ("speechSynthesis" in window) {
      speechRunRef.current += 1;
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
    }

    setMessages((previous) => [
      ...previous,
      {
        type: "user",
        text: userQuestion,
      },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`}/ai/chat`,
        {
          question: userQuestion,
          language: language,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      setMessages((previous) => [
        ...previous,
        {
          type: "ai",
          text: response.data.answer,
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((previous) => [
        ...previous,
        {
          type: "ai",
          text: "Sorry, I couldn't connect to the Elder Sense server. Please make sure the backend is running and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = async () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported in this browser. Please use Microsoft Edge or Google Chrome.");
      return;
    }

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        // Recognition may already have stopped; this is safe to ignore.
      }
      setListening(false);
      return;
    }

    setVoiceError("");

    try {
      // Request microphone permission explicitly so the browser can show its
      // permission prompt before SpeechRecognition starts.
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } else if (!window.isSecureContext) {
        throw new Error("MICROPHONE_REQUIRES_SECURE_CONTEXT");
      }

      const selectedLanguage = languages.find((item) => item.name === language);
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLanguage?.code || "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        setVoiceError("");
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          transcript += event.results[i][0]?.transcript || "";
        }
        if (transcript.trim()) {
          setQuestion(transcript.trim());
          setVoiceError("");
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setListening(false);

        const messages = {
          "not-allowed": "Microphone permission is blocked. In Microsoft Edge, click the lock icon beside the address bar → Permissions for this site → Microphone → Allow, then refresh the page.",
          "service-not-allowed": "The browser speech service is blocked. Allow microphone and speech access in your browser settings, then try again.",
          "no-speech": "No speech was detected. Click the microphone and speak clearly after it starts listening.",
          "audio-capture": "No microphone was detected. Connect or enable a microphone in Windows Settings.",
          network: "Tamil/voice typing uses your browser's online speech service. Check that the device has internet, turn off VPN/ad-blocking temporarily if used, and retry in the latest Google Chrome or Microsoft Edge. If it keeps failing, use the text box to type your question.",
          aborted: "Voice input was stopped. Click the microphone to try again.",
        };
        setVoiceError(messages[event.error] || "Voice input failed. Check microphone permissions and try again.");
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      // Reflect the pending start immediately to prevent rapid double-clicks.
      setListening(true);
      recognition.start();
    } catch (error) {
      console.error("Unable to start speech recognition:", error);
      setListening(false);

      if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
        setVoiceError("Microphone permission was denied. In Microsoft Edge, click the lock icon beside the address bar → Permissions for this site → Microphone → Allow, then refresh the page.");
      } else if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
        setVoiceError("No microphone was found. Connect or enable a microphone, then try again.");
      } else if (error?.message === "MICROPHONE_REQUIRES_SECURE_CONTEXT") {
        setVoiceError("Microphone access requires localhost or a secure HTTPS connection. Open Elder Sense using http://localhost:5173 or HTTPS.");
      } else {
        setVoiceError("Could not start the microphone. Check site microphone permissions and try again.");
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    askAI();
  };

  const quickQuestions = [
    {
      icon: <Pill size={18} />,
      label: "Medicine safety",
      question: "How should I take my medicine safely?",
    },
    {
      icon: <Utensils size={18} />,
      label: "Nutrition",
      question: "What are some healthy food choices for elderly people?",
    },
    {
      icon: <HeartPulse size={18} />,
      label: "Symptoms",
      question: "What should I do if I have a fever or pain?",
    },
    {
      icon: <ShieldCheck size={18} />,
      label: "Blood pressure",
      question: "How should I monitor my blood pressure?",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4fbfa] text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="flex h-20 items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition hover:bg-cyan-50 hover:text-cyan-600"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-purple-100">
              <Bot size={24} />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">
                AI Care Assistant
              </h1>

              <p className="hidden text-xs text-slate-400 sm:block">
                Your Elder Sense health companion
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Assistant Ready
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8">
        {/* Intro */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-7 text-white shadow-xl shadow-purple-100 sm:p-9">
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 right-28 h-64 w-64 rounded-full bg-white/10" />

          <div className="relative z-10 flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white/15 text-3xl backdrop-blur-sm">
              🤖
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-purple-100">
                <Sparkles size={16} />
                Smart health assistance
              </div>

              <h2 className="text-2xl font-bold sm:text-3xl">
                How can I help you today?
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-purple-100">
                Ask a simple question and I’ll provide general health and
                elderly-care information.
              </p>
            </div>
          </div>
        </section>

        {/* Quick questions */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={17} className="text-violet-500" />

            <h3 className="text-sm font-semibold text-slate-600">
              Quick questions
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickQuestions.map((item) => (
              <button
                key={item.label}
                onClick={() => askAI(item.question)}
                disabled={loading}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                  {item.icon}
                </div>

                <span className="text-sm font-semibold text-slate-600">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Chat */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                <MessageCircle size={19} />
              </div>

              <div>
                <h3 className="font-bold text-slate-700">
                  Elder Sense Assistant
                </h3>

                <p className="text-xs text-slate-400">
                  General health guidance
                </p>
              </div>
            </div>
          </div>

          <div className="min-h-[420px] max-h-[520px] space-y-5 overflow-y-auto bg-[#fbfefd] p-5 sm:p-7">
            {messages.map((message, index) => (
              <div
                key={`${message.type}-${index}`}
                className={`flex ${
                  message.type === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {message.type === "ai" && (
                  <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                    <Bot size={17} />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.type === "user"
                      ? "rounded-br-md bg-cyan-500 text-white"
                      : "rounded-bl-md border border-slate-100 bg-white text-slate-600 shadow-sm"
                  }`}
                >
                  {message.type === "ai" ? (
                    <>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="mb-3 last:mb-0">{children}</p>
                          ),

                          h1: ({ children }) => (
                            <h1 className="mb-3 text-lg font-bold text-slate-800">
                              {children}
                            </h1>
                          ),

                          h2: ({ children }) => (
                            <h2 className="mb-3 text-base font-bold text-slate-800">
                              {children}
                            </h2>
                          ),

                          h3: ({ children }) => (
                            <h3 className="mb-2 text-sm font-bold text-slate-800">
                              {children}
                            </h3>
                          ),

                          ul: ({ children }) => (
                            <ul className="mb-3 list-disc space-y-1 pl-5">
                              {children}
                            </ul>
                          ),

                          ol: ({ children }) => (
                            <ol className="mb-3 list-decimal space-y-1 pl-5">
                              {children}
                            </ol>
                          ),

                          li: ({ children }) => (
                            <li className="pl-1">{children}</li>
                          ),

                          strong: ({ children }) => (
                            <strong className="font-bold text-slate-800">
                              {children}
                            </strong>
                          ),

                          em: ({ children }) => (
                            <em className="italic">{children}</em>
                          ),

                          blockquote: ({ children }) => (
                            <blockquote className="my-3 border-l-4 border-violet-300 pl-4 text-slate-600">
                              {children}
                            </blockquote>
                          ),

                          code: ({ children }) => (
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                              {children}
                            </code>
                          ),

                          hr: () => (
                            <hr className="my-3 border-slate-200" />
                          ),

                          table: ({ children }) => (
                            <div className="my-3 w-full overflow-x-auto rounded-xl border border-slate-200">
                              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                                {children}
                              </table>
                            </div>
                          ),

                          thead: ({ children }) => (
                            <thead className="bg-violet-50">
                              {children}
                            </thead>
                          ),

                          tbody: ({ children }) => (
                            <tbody>{children}</tbody>
                          ),

                          tr: ({ children }) => (
                            <tr className="border-b border-slate-100 last:border-b-0">
                              {children}
                            </tr>
                          ),

                          th: ({ children }) => (
                            <th className="border-r border-slate-100 px-3 py-2 font-bold text-slate-700 last:border-r-0">
                              {children}
                            </th>
                          ),

                          td: ({ children }) => (
                            <td className="border-r border-slate-100 px-3 py-2 align-top text-slate-600 last:border-r-0">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {formatAIText(message.text)}
                      </ReactMarkdown>

                      {/* Voice output button */}
                      <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() =>
                            speakAIResponse(message.text, index)
                          }
                          title={
                            speakingIndex === index
                              ? "Stop speaking"
                              : `Listen in ${language}`
                          }
                          className={`flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                            speakingIndex === index
                              ? "bg-red-50 text-red-500 hover:bg-red-100"
                              : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                          }`}
                        >
                          {speakingIndex === index ? (
                            <>
                              <VolumeX size={16} />
                              Stop
                            </>
                          ) : (
                            <>
                              <Volume2 size={16} />
                              Listen
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    message.text
                  )}
                </div>

                {message.type === "user" && (
                  <div className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-lg">
                    👩🏻
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Bot size={17} />
                </div>

                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-100 bg-white p-4 sm:p-5"
          >
            {/* Language selector */}
            <div className="mb-3 flex items-center justify-end gap-2">
              <span className="text-xs font-semibold text-slate-500">
                🌐 Language
              </span>

              <select
                value={language}
                onChange={(event) => {
                  if ("speechSynthesis" in window) {
                    speechRunRef.current += 1;
                    window.speechSynthesis.cancel();
                  }

                  setVoiceError("");
                  setSpeakingIndex(null);
                  setLanguage(event.target.value);
                }}
                disabled={loading || listening}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {languages.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-50">
              <input
                type="text"
                value={question}
                onChange={(event) => { setQuestion(event.target.value); if (voiceError) setVoiceError(""); }}
                placeholder="Ask about medicines, nutrition, symptoms..."
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />

              {/* Voice input */}
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={loading}
                title={
                  listening ? "Stop listening" : "Speak your question"
                }
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md transition ${
                  listening
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-slate-700 hover:bg-slate-800"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {listening ? <MicOff size={19} /> : <Mic size={19} />}
              </button>

              <button
                type="submit"
                disabled={!question.trim() || loading}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 size={19} className="animate-spin" />
                ) : (
                  <Send size={19} />
                )}
              </button>
            </div>

            {listening && (
              <p className="mt-2 text-center text-xs font-medium text-red-500">
                🎤 Listening... Speak your question.
              </p>
            )}
            {voiceError && (
              <p role="status" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                🎙️ {voiceError}
              </p>
            )}
          </form>
        </section>

        {/* Safety note */}
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <div className="mt-0.5 shrink-0 text-amber-500">
            <ShieldCheck size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-amber-800">
              Important health note
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700">
              Elder Sense provides general information and does not replace a
              qualified doctor or other healthcare professional. For
              emergencies or serious symptoms, seek medical help immediately.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AIAssistant;