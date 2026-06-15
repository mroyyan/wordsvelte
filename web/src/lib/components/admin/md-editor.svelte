<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import 'ckeditor5/dist/ckeditor5.css'
  import MediaLibrary from './media/media-library.svelte'
  import { Image } from '@lucide/svelte'
  import { Button } from '$lib/components/ui/button'

  let { value = $bindable('') } = $props()
  let el: HTMLDivElement
  let instance: any
  let showMediaLibrary = $state(false)

  class MyUploadAdapter {
    loader: any;
    constructor(loader: any) { this.loader = loader; }
    async upload() {
      const file = await this.loader.file;
      const tok = localStorage.getItem('wordsvelte_token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
        body: formData
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { default: `/api/media/${json.data.r2Key}` };
    }
    abort() {}
  }

  function MyCustomUploadAdapterPlugin(editor: any) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader: any) => {
      return new MyUploadAdapter(loader);
    };
  }

  onMount(async () => {
    const {
      ClassicEditor, Essentials, Bold, Italic, Heading, Link, List, BlockQuote,
      Paragraph, Undo, Table, Image, ImageCaption, ImageStyle,
      ImageToolbar, ImageUpload, ImageResize, Code, CodeBlock
    } = await import('ckeditor5')

    instance = await ClassicEditor.create(el, {
      licenseKey: 'GPL',
      plugins: [
        Essentials, Bold, Italic, Heading, Link, List, BlockQuote,
        Paragraph, Undo, Table, Image, ImageCaption, ImageStyle,
        ImageToolbar, ImageUpload, ImageResize, Code, CodeBlock,
        MyCustomUploadAdapterPlugin
      ],
      initialData: value,
      toolbar: ['heading', '|', 'bold', 'italic', 'code', 'link', '|', 'bulletedList', 'numberedList', 'codeBlock', 'blockQuote', '|', 'insertTable', '|', 'undo', 'redo'],
      image: {
        toolbar: [
          'imageTextAlternative', '|',
          'imageStyle:inline', 'imageStyle:wrapText', 'imageStyle:breakText',
          '|', 'resizeImage'
        ],
        resizeUnit: '%',
        resizeType: 'both'
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
          { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
          { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
          { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        ],
      },
    })
    instance.model.document.on('change:data', () => {
      value = instance.getData()
    })
  })

  onDestroy(() => {
    instance?.destroy()
  })
</script>

<div class="relative">
  <div class="absolute right-2 top-1 z-10">
    <Button
      type="button"
      variant="outline"
      size="sm"
      class="h-8 gap-1.5"
      onclick={() => showMediaLibrary = true}
    >
      <Image class="h-4 w-4" />
      Browse Media
    </Button>
  </div>
  <div bind:this={el}></div>
</div>

<MediaLibrary
  bind:open={showMediaLibrary}
  onSelect={(url: string) => {
    instance.model.change((writer: any) => {
      const imageElement = writer.createElement('imageBlock', { src: url });
      instance.model.insertObject(imageElement, instance.model.document.selection.getFirstPosition());
    });
  }}
/>

<style>
  :global(.ck-editor) {
    border-radius: var(--radius);
    overflow: clip;
    --ck-color-base-background: transparent;
    --ck-color-toolbar-background: transparent;
    --ck-color-base-border: var(--border);
    --ck-color-toolbar-border: var(--border);
    --ck-color-text: var(--foreground);
    --ck-color-editor-base-text: var(--foreground);
    --ck-color-button-default-hover-background: var(--accent);
    --ck-color-button-on-background: var(--accent);
  }
  :global(.ck-editor__editable) {
    min-height: 300px;
    max-height: 900px;
    overflow-y: auto !important;
    background-color: transparent !important;
    color: var(--foreground) !important;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
  }
  :global(.ck-editor__editable::-webkit-scrollbar) {
    width: 6px;
  }
  :global(.ck-editor__editable::-webkit-scrollbar-track) {
    background: transparent;
  }
  :global(.ck-editor__editable::-webkit-scrollbar-thumb) {
    background: var(--border);
    border-radius: 3px;
  }
  :global(.ck-editor__editable::-webkit-scrollbar-thumb:hover) {
    background: var(--muted-foreground);
  }
  :global(.ck-toolbar) {
    background-color: var(--muted) !important;
    border-color: var(--border) !important;
  }
  :global(.ck-content) {
    color: var(--foreground) !important;
  }
  :global(.dark .ck-editor) {
    --ck-color-base-background: var(--background);
    --ck-color-toolbar-background: var(--muted);
    --ck-color-base-border: var(--border);
    --ck-color-text: #fff;
    --ck-color-editor-base-text: #fff;
    --ck-color-list-background: var(--background);
    --ck-color-panel-background: var(--background);
    --ck-color-panel-border: var(--border);
    --ck-color-input-background: var(--background);
    --ck-color-button-default-hover-background: var(--accent);
    --ck-color-dropdown-panel-background: var(--background);
  }
  :global(.ck-editor__editable_inline) {
    border-color: var(--border) !important;
  }
  :global(.ck-editor__editable h1) {
    font-size: 2em;
    font-weight: 700;
    line-height: 1.2;
    margin-top: 0.5em;
    margin-bottom: 0.25em;
  }
  :global(.ck-editor__editable h2) {
    font-size: 1.5em;
    font-weight: 700;
    line-height: 1.3;
    margin-top: 0.5em;
    margin-bottom: 0.25em;
  }
  :global(.ck-editor__editable h3) {
    font-size: 1.25em;
    font-weight: 600;
    line-height: 1.4;
    margin-top: 0.5em;
    margin-bottom: 0.25em;
  }
  :global(.ck-editor__editable ul),
  :global(.ck-editor__editable ol) {
    margin: 0.75em 0;
    padding-left: 1.5em;
  }
  :global(.ck-editor__editable ul) {
    list-style-type: disc;
  }
  :global(.ck-editor__editable ul ul) {
    list-style-type: circle;
  }
  :global(.ck-editor__editable ul ul ul) {
    list-style-type: square;
  }
  :global(.ck-editor__editable ol) {
    list-style-type: decimal;
  }
  :global(.ck-editor__editable ol ol) {
    list-style-type: lower-alpha;
  }
  :global(.ck-editor__editable li) {
    margin: 0.25em 0;
    line-height: 1.7;
    padding-left: 0.25em;
  }
  :global(.ck-editor__editable li > ul),
  :global(.ck-editor__editable li > ol) {
    margin: 0.25em 0;
  }
  :global(.ck-editor__editable p) {
    margin: 0.75em 0;
    line-height: 1.8;
  }
  :global(.ck-editor__editable blockquote) {
    border-left: 4px solid var(--border);
    margin: 1em 0;
    padding: 0.5em 1em;
    background: var(--muted);
    border-radius: 0 var(--radius) var(--radius) 0;
    color: var(--muted-foreground);
    font-style: italic;
  }
  :global(.ck-editor__editable code) {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    background: var(--muted);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
    color: var(--foreground);
  }
  :global(.ck-editor__editable pre) {
    background: #1e1e2e;
    color: #cdd6f4;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    padding: 1em 1.25em;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1em 0;
    line-height: 1.6;
    font-size: 0.875em;
    border: 1px solid #313244;
    scrollbar-width: thin;
    scrollbar-color: #45475a #1e1e2e;
  }
  :global(.ck-editor__editable pre::-webkit-scrollbar) {
    height: 6px;
  }
  :global(.ck-editor__editable pre::-webkit-scrollbar-track) {
    background: #1e1e2e;
    border-radius: 3px;
  }
  :global(.ck-editor__editable pre::-webkit-scrollbar-thumb) {
    background: #45475a;
    border-radius: 3px;
  }
  :global(.ck-editor__editable pre::-webkit-scrollbar-thumb:hover) {
    background: #585b70;
  }
  :global(.ck-editor__editable pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
    color: inherit;
  }
</style>
