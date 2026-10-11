import { useEffect } from "react";

/**
 * Proteções client-side contra cópia casual:
 * - bloqueia menu de contexto (botão direito)
 * - bloqueia teclas de devtools / view-source / salvar
 * - bloqueia arrastar imagens
 * - desabilita seleção de texto
 *
 * Aviso: nenhuma dessas medidas é segurança real. Quem souber abrir
 * o navegador com JS desligado ou usar `view-source:` ainda consegue.
 * Serve apenas para desencorajar usuários casuais.
 */
export function useAntiCopy() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12") {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd combos
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const k = e.key.toLowerCase();
      // Ctrl+U (view-source), Ctrl+S (salvar), Ctrl+P (imprimir)
      if (k === "u" || k === "s" || k === "p") {
        e.preventDefault();
        return;
      }
      // Ctrl+Shift+I / J / C (devtools, console, inspetor)
      if (e.shiftKey && (k === "i" || k === "j" || k === "c")) {
        e.preventDefault();
      }
    };

    const onDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "IMG") {
        e.preventDefault();
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("copy", onCopy);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("copy", onCopy);
    };
  }, []);
}
