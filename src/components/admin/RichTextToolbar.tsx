import { Bold, Italic, Underline, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RichTextToolbarProps {
  textareaRef: HTMLTextAreaElement | null;
  value: string;
  onChange: (value: string) => void;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  openTag: string,
  closeTag: string,
  onChange: (v: string) => void
) {
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const selected = value.substring(start, end);
  if (!selected) return;

  const newValue = value.substring(0, start) + openTag + selected + closeTag + value.substring(end);
  onChange(newValue);

  setTimeout(() => {
    textarea.focus();
    const newPos = start + openTag.length + selected.length + closeTag.length;
    textarea.setSelectionRange(newPos, newPos);
  }, 0);
}

export const RichTextToolbar = ({ textareaRef, value, onChange }: RichTextToolbarProps) => {
  const applyFormat = (tag: string) => {
    if (!textareaRef) return;
    wrapSelection(textareaRef, value, `<${tag}>`, `</${tag}>`, onChange);
  };

  const applyFontSize = (size: string) => {
    if (!textareaRef || size === 'default') return;
    wrapSelection(
      textareaRef,
      value,
      `<span style="font-size:${size}px">`,
      '</span>',
      onChange
    );
  };

  return (
    <div className="flex items-center gap-1 pb-1.5 border-b mb-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => applyFormat('b')}
        title="Bold"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => applyFormat('i')}
        title="Italic"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => applyFormat('u')}
        title="Underline"
      >
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <div className="h-4 w-px bg-border mx-1" />
      <div className="flex items-center gap-1">
        <Type className="h-3.5 w-3.5 text-muted-foreground" />
        <Select onValueChange={applyFontSize}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default</SelectItem>
            <SelectItem value="12">Small (12)</SelectItem>
            <SelectItem value="14">Normal (14)</SelectItem>
            <SelectItem value="16">Medium (16)</SelectItem>
            <SelectItem value="18">Large (18)</SelectItem>
            <SelectItem value="22">XL (22)</SelectItem>
            <SelectItem value="28">XXL (28)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
