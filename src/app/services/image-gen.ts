import { Injectable } from '@angular/core';
import { loadModel, generateImage, ModelId, GenerateParams } from 'web-txt2img';
import { BehaviorSubject } from 'rxjs';

export interface ImageGenState {
  progress: number;
  status: string;
  isReady: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ImageGenService {
  private modelId: ModelId = 'sd-turbo'; 
  private isLoaded = false;
  
  private stateSub = new BehaviorSubject<ImageGenState>({ progress: 0, status: '', isReady: false });
  public state$ = this.stateSub.asObservable();

  constructor() { }

  async initialize() {
    if (this.isLoaded) return;
    
    try {
      this.stateSub.next({ progress: 0, status: 'Cargando motor de imágenes (WebGPU SD-Turbo)...', isReady: false });
      
      await loadModel(this.modelId, {
        onProgress: (p: any) => {
          this.stateSub.next({ progress: 70, status: 'Descargando modelo en memoria...', isReady: false });
        }
      });
      
      this.isLoaded = true;
      this.stateSub.next({ progress: 100, status: 'Motor de imágenes local listo', isReady: true });
    } catch (error: any) {
      console.error("Image Gen Error:", error);
      this.stateSub.next({ progress: 0, status: 'Error al cargar motor WebGPU de imágenes: ' + error.message, isReady: false });
    }
  }

  async generateImage(promptText: string): Promise<string> {
    if (!this.isLoaded) throw new Error("Generador de imágenes no está listo.");
    
    this.stateSub.next({ progress: 0, status: 'Generando imagen (puede tardar en celulares)...', isReady: true });
    
    try {
      const params: GenerateParams = {
        model: this.modelId,
        prompt: promptText,
        numInferenceSteps: 4, 
        guidanceScale: 1
      } as any;
      
      const result: any = await generateImage(params);
      
      this.stateSub.next({ progress: 100, status: '¡Generación completada!', isReady: true });
      
      // Convertir ImageData (u otros formatos estándar del GenerateResult) a Base64 para el tag img
      if (result && result.image) {
         try {
           const canvas = document.createElement('canvas');
           canvas.width = result.image.width || 512; 
           canvas.height = result.image.height || 512;
           const ctx = canvas.getContext('2d')!;
           
           if (result.image instanceof ImageData) {
             ctx.putImageData(result.image, 0, 0);
           } else {
             // Si es HTMLImageElement o ImageBitmap
             ctx.drawImage(result.image, 0, 0);
           }
           return canvas.toDataURL();
         } catch (e) {
             console.error("No se pudo convertir de canvas", e);
         }
      }
      
      if (result && typeof result.toDataURL === 'function') {
        return result.toDataURL();
      }

      // Si nos devuelve objectos en array "images"
      if (result && Array.isArray(result.images) && result.images.length > 0) {
          const img = result.images[0];
          if (img.toDataURL) return img.toDataURL();
          const canvas = document.createElement('canvas');
          canvas.width = img.width || 512; canvas.height = img.height || 512;
          const ctx = canvas.getContext('2d')!;
          if (img instanceof ImageData) {
             ctx.putImageData(img, 0, 0);
          } else {
             ctx.drawImage(img, 0, 0);
          }
          return canvas.toDataURL();
      }
      
      throw new Error('El modelo no devolvió un formato de imagen renderizable esperado.');
    } catch (err) {
      this.stateSub.next({ progress: 100, status: 'Fallo al generar la imagen', isReady: true });
      throw err;
    }
  }
}
