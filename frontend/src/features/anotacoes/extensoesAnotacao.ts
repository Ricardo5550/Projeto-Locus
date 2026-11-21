import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Typography from "@tiptap/extension-typography";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";

export function extensoesAnotacao() {
  return [
    StarterKit,
    Image.configure({ allowBase64: true }),
    Typography,
    TextStyle,
    Color,
    FontFamily,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
  ];
}
