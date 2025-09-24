import { useState, useEffect, useRef } from 'react';

class JeevesBot {
    constructor(options = {}) {
        this.domain = options.domain || "gmail.com";
        this.maxChatsPerAccount = options.maxChatsPerAccount || 10;
        this.cachedAccount = null;
        this.chatCounter = 0;
        this.apiKey = options.apiKey || "AIzaSyAk6elDmKNcUhK6aO-OhjHsyIbQc1FiAiU";
        this.firebaseVersion = options.firebaseVersion || "Chrome/JsCore/9.22.2/FirebaseCore-web";
    }

    generateRandomEmail() {
        const username = Math.random().toString(36).substring(2, 10);
        return `${username}@${this.domain}`;
    }

    generateRandomPassword(length = 12) {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async signUp() {
        const email = this.generateRandomEmail();
        const password = this.generateRandomPassword();
        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${this.apiKey}`;

        const payload = {
            returnSecureToken: true,
            email: email,
            password: password,
            clientType: "CLIENT_TYPE_WEB"
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Origin': 'https://jeeves.ai',
            'x-client-version': this.firebaseVersion,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                console.log("✅ Akun baru dibuat:", email);
                this.cachedAccount = data;
                this.chatCounter = 0;
                return data;
            } else {
                console.error("❌ Sign up gagal:", data);
                return null;
            }
        } catch (error) {
            console.error("🚨 Error saat sign up:", error);
            return null;
        }
    }

    async getAccount() {
        if (!this.cachedAccount || this.chatCounter >= this.maxChatsPerAccount) {
            return await this.signUp();
        } else {
            this.chatCounter++;
            return this.cachedAccount;
        }
    }

    async readStreamedResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let answer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') continue;

                    try {
                        const json = JSON.parse(jsonStr);
                        if (json.text) {
                            answer += json.text;
                        }
                    } catch (e) {
                        // Abaikan error parsing kecil
                    }
                }
            }
        }

        return answer.trim();
    }

    async chat(promptText = "Hi?", useAuth = false) {
        let authHeader = '';

        if (useAuth) {
            const account = await this.getAccount();
            if (!account) {
                console.error("❌ Gagal mendapatkan akun.");
                return;
            }
            authHeader = 'Bearer ' + account.idToken;
        }

        const url = 'https://api.jeeves.ai/generate/v4/chat';

        const payload = {
            prompt: promptText
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Authorization': authHeader,
            'Origin': 'https://jeeves.ai',
            'Referer': 'https://jeeves.ai/',
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const data = await this.readStreamedResponse(response);
            return data;
        } catch (error) {
            console.error("🚨 Terjadi error saat chat:", error);
        }
    }
}

export default function ChatAI() {
    const [messages, setMessages] = useState([
        { id: 1, text: "Halo! Saya adalah asisten AI. Ada yang bisa saya bantu?", sender: 'ai' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const botRef = useRef(null);

    // Inisialisasi bot saat komponen dimuat
    useEffect(() => {
        botRef.current = new JeevesBot({
            domain: "gmail.com",
            maxChatsPerAccount: 10
        });
    }, []);

    // Auto scroll ke bawah saat ada pesan baru
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async () => {
        if (inputText.trim() === '') return;
        
        // Tambahkan pesan user
        const userMessage = {
            id: messages.length + 1,
            text: inputText,
            sender: 'user'
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        
        try {
            // Panggil bot.chat()
            const response = await botRef.current.chat(inputText, true);
            
            // Tambahkan pesan AI
            const aiMessage = {
                id: messages.length + 2,
                text: response || "Maaf, saya tidak dapat merespons saat ini.",
                sender: 'ai'
            };
            
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Error:", error);
            // Tambahkan pesan error
            const errorMessage = {
                id: messages.length + 2,
                text: "Terjadi kesalahan. Silakan coba lagi.",
                sender: 'ai'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm py-4 px-6">
                <div className="max-w-4xl mx-auto flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-3">
                        AI
                    </div>
                    <h1 className="text-xl font-semibold text-gray-800">Asisten AI</h1>
                </div>
            </header>

            {/* Chat Container */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full">
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
                                    message.sender === 'user'
                                        ? 'bg-blue-500 text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 rounded-tl-none shadow-sm'
                                }`}
                            >
                                <div className="whitespace-pre-wrap">{message.text}</div>
                            </div>
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white text-gray-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t py-4 px-4 md:px-6">
                <div className="max-w-4xl mx-auto flex">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Ketik pesan Anda..."
                        className="flex-1 border border-gray-300 rounded-l-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || inputText.trim() === ''}
                        className={`bg-blue-500 text-white rounded-r-lg px-6 py-3 font-medium ${
                            isLoading || inputText.trim() === '' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                        }`}
                    >
                        {isLoading ? 'Mengirim...' : 'Kirim'}
                    </button>
                </div>
            </div>
        </div>
    );
}
