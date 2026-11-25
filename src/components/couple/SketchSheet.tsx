"use client";

import { Send } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button, Sheet, useToast } from "@/components/ui";
import { uploadMedia } from "@/lib/media";
import type { Message } from "@/lib/types";
import { DrawingCanvas, DrawingToolbar } from "./DrawingCanvas";
import { BoardModel, PALETTE, SIZES, exportPng, type Tool } from "./drawing";
import { insertMessage, notifyNewMessage } from "./lib";

/** Modèle de tableau + numéro de version (pour re-rendre l'interface). */
export function useBoardModel() {
  const [model] = useState(() => new BoardModel());
  const version = useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion);
  return { model, version };
}

export const DEFAULT_TOOL: Tool = { color: PALETTE[0], size: SIZES[1].value, erase: false };

/** Petit croquis dessiné dans une feuille puis envoyé dans la discussion. */
export function SketchSheet({
  open,
  onClose,
  meId,
  myName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  myName: string;
  onSent: (m: Message) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="🎨 Un petit dessin">
      {open && <SketchBody meId={meId} myName={myName} onClose={onClose} onSent={onSent} />}
    </Sheet>
  );
}

function SketchBody({ meId, myName, onClose, onSent }: { meId: string; myName: string; onClose: () => void; onSent: (m: Message) => void }) {
  const toast = useToast();
  const { model, version } = useBoardModel();
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL);
  const [sending, setSending] = useState(false);
  const empty = version >= 0 && model.strokes.length === 0;

  async function send() {
    if (!model.strokes.length) return;
    setSending(true);
    try {
      const blob = await exportPng(model.strokes, 900);
      const path = await uploadMedia("couple", blob, "png");
      const m = await insertMessage(meId, { kind: "drawing", media_path: path });
      notifyNewMessage(myName, "drawing");
      onSent(m);
      onClose();
    } catch {
      toast("Oups, le dessin n'est pas parti 😕", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <DrawingCanvas model={model} tool={tool} meId={meId} className="h-[min(56dvh,480px)] w-full" />
      <DrawingToolbar
        tool={tool}
        onChange={setTool}
        canUndo={!empty}
        onUndo={() => {
          const last = model.lastBy(meId);
          if (last) model.remove(last.id);
        }}
        onClear={() => model.clear()}
      />
      <Button className="w-full" size="lg" disabled={empty} loading={sending} onClick={send}>
        <Send className="size-5" /> Envoyer le dessin
      </Button>
    </div>
  );
}
