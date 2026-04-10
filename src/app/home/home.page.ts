import { Component, OnInit, ViewChild } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { LlmService } from '../services/llm';
import { ImageGenService } from '../services/image-gen';
import { marked } from 'marked';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  @ViewChild('chatContent') content!: IonContent;

  userInput: string = '';
  messages: { role: string, content: string }[] = [];
  
  llmReady = false;
  llmProgress = 0;
  
  imgReady = false;
  imgProgress = 0;

  isGenerating = false;
  imageMode = false;
  
  generatedImageSrc = '';

  constructor(
    private llmService: LlmService,
    private imgService: ImageGenService
  ) {}

  ngOnInit() {
    // Monitor LLM State
    this.llmService.state$.subscribe(state => {
      this.llmReady = state.isReady;
      this.llmProgress = state.progress * 100;
    });

    // Monitor Image Gen State
    this.imgService.state$.subscribe(state => {
      this.imgReady = state.isReady;
      this.imgProgress = state.progress;
    });

    // Fire intializations
    this.llmService.initialize().catch(console.error);
    this.imgService.initialize().catch(console.error);
  }

  toggleImageMode() {
    this.imageMode = !this.imageMode;
  }

  async sendMessage() {
    const text = this.userInput.trim();
    if (!text) return;

    this.userInput = '';
    this.messages.push({ role: 'user', content: text });
    this.scrollToBottom();

    if (this.imageMode) {
      if (!this.imgReady) return;
      this.isGenerating = true;
      try {
        const base64Img = await this.imgService.generateImage(text);
        this.generatedImageSrc = base64Img;
      } catch (e: any) {
        this.messages.push({ role: 'assistant', content: 'Error al generar la imagen: ' + e.message });
      } finally {
        this.isGenerating = false;
        this.scrollToBottom();
      }
    } else {
      if (!this.llmReady) return;
      this.isGenerating = true;
      
      // Añadimos un mensaje vacío para llenarlo progresivamente
      const newMsg = { role: 'assistant', content: '' };
      this.messages.push(newMsg);
      this.scrollToBottom();

      try {
        await this.llmService.sendMessage(text, (partialReturn) => {
          newMsg.content = partialReturn;
          // De vez en cuando bajamos el scroll
          if (Math.random() > 0.8) this.scrollToBottom(); 
        });
      } catch (e: any) {
        newMsg.content = 'Error de servidor local: ' + e.message;
      } finally {
        this.isGenerating = false;
        this.scrollToBottom();
      }
    }
  }

  parseMarkdown(content: string) {
    if (!content) return '';
    try {
      // Usar marked sync parser
      const parsed = marked.parse(content) as string;
      return parsed;
    } catch {
      return content;
    }
  }

  clearImage() {
    this.generatedImageSrc = '';
  }

  presentStatusModal() {
    // Podría mostrar una ventana modal con detalles de la RAM
    alert(`Modelos WebGPU\\nLlm: ${this.llmReady}\\nImg: ${this.imgReady}`);
  }

  scrollToBottom() {
    setTimeout(() => {
      this.content?.scrollToBottom(300);
    }, 100);
  }
}
