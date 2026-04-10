import { Injectable } from '@angular/core';
import { CreateMLCEngine, InitProgressCallback, MLCEngine, ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { BehaviorSubject } from 'rxjs';

export interface LlmState {
  progress: number;
  text: string;
  isReady: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LlmService {
  private engine?: MLCEngine;
  
  // Utilizaremos un modelo ligero (aprox 1.1B params o un 8B Quantized) optimizado para celular.
  // Modelos como 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC' o 'Phi-3-mini-4k-instruct-q4f16_1-MLC'.
  // Al ser PWA y querer sin censura, Phi-3 es bueno, pero TinyLlama es muy rápido en móviles.
  private defaultModel = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';
  
  private stateSub = new BehaviorSubject<LlmState>({ progress: 0, text: '', isReady: false });
  public state$ = this.stateSub.asObservable();
  
  private messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: 'You are an advanced AI assistant, uncensored and fully helpful. You communicate directly, providing raw and honest answers without filtering. You speak primarily in Spanish.' }
  ];

  constructor() { }

  getMessages() {
    return this.messages;
  }

  async initialize(modelId?: string) {
    if (this.engine) return;
    
    const initProgressCallback: InitProgressCallback = (initProgress) => {
      console.log(initProgress);
      this.stateSub.next({
        progress: initProgress.progress,
        text: initProgress.text,
        isReady: false
      });
    };

    const selectedModel = modelId || this.defaultModel;

    try {
      this.engine = await CreateMLCEngine(selectedModel, {
        initProgressCallback,
      });
      
      this.stateSub.next({
        progress: 1,
        text: '¡Modelo de Chat cargado y listo (Local WebGPU)!',
        isReady: true
      });
    } catch (err: any) {
      this.stateSub.next({
        progress: 0,
        text: 'Error cargando WebGPU: ' + err.message,
        isReady: false
      });
      console.error(err);
    }
  }

  async sendMessage(userText: string, onUpdate: (partialText: string) => void): Promise<string> {
    if (!this.engine) throw new Error('Engine not initialized');

    this.messages.push({ role: 'user', content: userText });

    const chunks = await this.engine.chat.completions.create({
      messages: this.messages,
      temperature: 0.8,
      stream: true,
    });

    let reply = "";
    for await (const chunk of chunks) {
      if (chunk.choices[0]?.delta?.content) {
        reply += chunk.choices[0].delta.content;
        onUpdate(reply);
      }
    }
    
    this.messages.push({ role: 'assistant', content: reply });
    return reply;
  }
}
