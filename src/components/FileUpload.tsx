import { useCallback } from "react";
import { Upload } from "lucide-react";

interface Props {
  onFileLoaded: (data: ArrayBuffer, name: string) => void;
}

export function FileUpload({ onFileLoaded }: Props) {
  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onFileLoaded(e.target.result as ArrayBuffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,.csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={handleClick}
      className="border-2 border-dashed border-primary/30 rounded-2xl p-16 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all duration-300"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">
            Przeciągnij plik lub kliknij
          </p>
          <p className="text-muted-foreground mt-1">
            Obsługiwane formaty: XLSX, XLS, CSV
          </p>
        </div>
      </div>
    </div>
  );
}
