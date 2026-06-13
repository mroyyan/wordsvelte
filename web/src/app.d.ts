declare namespace App {
  interface Platform {
    env: {
      DB: D1Database
      R2: R2Bucket
      JWT_SECRET: string
    }
  }
}

declare module 'ckeditor5' {
  export const ClassicEditor: any
  export const Essentials: any
  export const Bold: any
  export const Italic: any
  export const Heading: any
  export const Link: any
  export const List: any
  export const BlockQuote: any
  export const Paragraph: any
  export const Undo: any
  export const Table: any
  export const Image: any
  export const ImageCaption: any
  export const ImageStyle: any
  export const ImageToolbar: any
  export const ImageUpload: any
  export const ImageResize: any
}
