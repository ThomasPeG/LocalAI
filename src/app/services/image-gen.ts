import { Injectable } from '@angular/core';
import { pipeline, env } from '@huggingface/transformers';
import { BehaviorSubject } from 'rxjs';

// Configurar transformers para ejecutarse en entorno de navegador.
env.allowLocalModels = false;
env.useBrowserCache = true;

export interface ImageGenState {
  progress: number;
  status: string;
  isReady: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ImageGenService {
  private generator: any = null;
  // Usaremos un modelo más ligero para prevenir cuelgues constantes.
  // 'Xenova/sd-turbo' es más pequeño, pero si requiere menos consumo se usa LCM.
  private modelId = 'Xenova/sd-turbo'; 
  
  private stateSub = new BehaviorSubject<ImageGenState>({ progress: 0, status: '', isReady: false });
  public state$ = this.stateSub.asObservable();

  constructor() { }

  async initialize() {
    if (this.generator) return;
    
    try {
      this.stateSub.next({ progress: 0, status: 'Cargando motor de imágenes (WebGPU)...', isReady: false });
      const pipeString: any = 'text-to-image';
      this.generator = await pipeline(pipeString, this.modelId, {
        device: 'webgpu', // Utiliza aceleración de tarjeta gráfica obligatoriamente
        progress_callback: (x: any) => {
          if (x.status === 'progress') {
            const pct = typeof x.progress === 'number' ? x.progress : 0;
            this.stateSub.next({ progress: pct, status: `Descargando motor SD: ${x.file || '...'} (${Math.round(pct)}%)`, isReady: false });
          }
        }
      });
      
      this.stateSub.next({ progress: 100, status: 'Motor de imágenes local listo', isReady: true });
    } catch (error: any) {
      console.error("Image Gen Error:", error);
      this.stateSub.next({ progress: 0, status: 'Error al cargar motor WebGPU de imágenes: ' + error.message, isReady: false });
    }
  }

  async generateImage(prompt: string): Promise<string> {
    if (!this.generator) throw new Error("Generador de imágenes no está listo.");
    
    this.stateSub.next({ progress: 0, status: 'Generando imagen (puede tardar en celulares)...', isReady: true });
    
    try {
      // Configuraciones turbo para Stable Diffusion (muy pocos pasos)
      const result: any = await this.generator(prompt, {
        num_inference_steps: 4, 
        guidance_scale: 1, 
      });
      
      this.stateSub.next({ progress: 100, status: '¡Generación completada!', isReady: true });
      
      if (Array.isArray(result) && result[0]) {
        if (typeof result[0].toDataURL === 'function') {
          return result[0].toDataURL(); 
        } else if (result[0].data) {
          // Intentar fallbacks
          throw new Error('Formato crudo devuelto. Se necesita canvas manual.');
        }
      }
      throw new Error('El modelo no devolvió una imagen válida.');
    } catch (err) {
      this.stateSub.next({ progress: 100, status: 'Fallo al generar la imagen', isReady: true });
      throw err;
    }
  }
}
