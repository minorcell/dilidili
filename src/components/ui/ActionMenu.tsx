import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, FileVideo, FolderOpen, Music } from 'lucide-react';
import Button from './Button';

export type VideoFormat = 'mp4' | 'avi' | 'mkv';
export type AudioFormat = 'mp3' | 'aac' | 'wav';

interface ActionMenuProps {
  onOpenFolder: () => void;
  onConvert: (format: VideoFormat) => void;
  onExtractAudio: (format: AudioFormat) => void;
}

const itemClass =
  'flex w-full cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-fg outline-none data-[highlighted]:bg-inset';

const labelClass = 'px-2.5 pb-1 pt-2 text-[11px] font-medium text-subtle-fg';

/** 已完成任务的操作菜单：转换格式、导出音频、打开所在位置 */
export default function ActionMenu({ onOpenFolder, onConvert, onExtractAudio }: ActionMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm">
          更多操作
          <ChevronDown size={12} aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="animate-menu-in z-[9999] w-44 rounded-xl border border-line bg-canvas p-1 shadow-lg"
        >
          <DropdownMenu.Label className={labelClass}>转换为视频</DropdownMenu.Label>
          {(['mp4', 'avi', 'mkv'] as const).map((format) => (
            <DropdownMenu.Item
              key={format}
              className={itemClass}
              onSelect={() => onConvert(format)}
            >
              <FileVideo size={13} className="text-muted" aria-hidden="true" />
              {format.toUpperCase()}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-line-muted" />

          <DropdownMenu.Label className={labelClass}>导出音频</DropdownMenu.Label>
          {(['mp3', 'aac', 'wav'] as const).map((format) => (
            <DropdownMenu.Item
              key={format}
              className={itemClass}
              onSelect={() => onExtractAudio(format)}
            >
              <Music size={13} className="text-muted" aria-hidden="true" />
              {format.toUpperCase()}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-line-muted" />

          <DropdownMenu.Item className={itemClass} onSelect={onOpenFolder}>
            <FolderOpen size={13} className="text-muted" aria-hidden="true" />
            在文件夹中显示
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
