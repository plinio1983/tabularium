"use client";

import {useEffect, useRef, useState} from "react";

export type AttachmentTypeValue = "INVOICE" | "DOCUMENT" | "PAYMENT_RECEIPT";
export type FormAttachment = {id: number; originalName: string; sizeBytes?: number | null; type?: AttachmentTypeValue | null};

const typeOptions: Array<{value: AttachmentTypeValue; label: string; icon: string}> = [
  {value: "INVOICE", label: "Fattura", icon: "▤"},
  {value: "DOCUMENT", label: "Documento", icon: "📄"},
  {value: "PAYMENT_RECEIPT", label: "Ricevuta accredito", icon: "€"},
];

export default function AttachmentFormSection({initialAttachments = [], onStateChange, focusOnMount = false}: {initialAttachments?: FormAttachment[]; onStateChange?: (count: number, error: string) => void; focusOnMount?: boolean}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLDetailsElement>(null);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [existingTypes, setExistingTypes] = useState<Record<number, AttachmentTypeValue>>(() => Object.fromEntries(initialAttachments.map(item => [item.id, item.type ?? "DOCUMENT"])));
  const [files, setFiles] = useState<File[]>([]);
  const [fileTypes, setFileTypes] = useState<AttachmentTypeValue[]>([]);
  const retained = initialAttachments.filter(item => !removedIds.includes(item.id));
  const count = retained.length + files.length;
  const error = count > 5 ? "Puoi caricare massimo 5 allegati complessivi." : "";

  useEffect(() => onStateChange?.(count, error), [count, error, onStateChange]);
  useEffect(() => {
    if (!focusOnMount) return;
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'}));
  }, [focusOnMount]);

  function removeFile(index: number) {
    const nextFiles = files.filter((_, itemIndex) => itemIndex !== index);
    const transfer = new DataTransfer();
    nextFiles.forEach(file => transfer.items.add(file));
    if (inputRef.current) inputRef.current.files = transfer.files;
    setFiles(nextFiles);
    setFileTypes(current => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return <details ref={sectionRef} className="form-section full app-form-wizard-step app-form-wizard-step-7" open>
    <summary><span>Allegati</span><small>File, XML e P7M</small></summary>
    <div className="form-section-stack">
      <label className="card attachment-row-wrap">
        <div className="attachment-row-title">Allegati &nbsp;<small className="text-warning">PDF, immagini, XML, P7M</small></div>
        <div className="flex attachment-row">
          <input ref={inputRef} type="file" name="attachments" accept=".pdf,.jpg,.jpeg,.png,.webp,.xml,.p7m" multiple onChange={event => {
            const selected = Array.from(event.currentTarget.files ?? []);
            setFiles(selected);
            setFileTypes(selected.map(() => "DOCUMENT"));
          }}/>
          <div className="field-note attachments-note">Limite allegati &nbsp;<br/><strong>5 file</strong></div>
        </div>
      </label>
      {retained.map(attachment => {
        const currentType = existingTypes[attachment.id] ?? "DOCUMENT";
        return <div className="card attachment-type-item" key={attachment.id}>
          <input type="hidden" name="existingAttachmentIds" value={attachment.id}/><input type="hidden" name="existingAttachmentTypes" value={currentType}/>
          <div className="attachment-type-item-heading"><span aria-hidden="true">📎</span><strong>{attachment.originalName}</strong><small>{attachment.sizeBytes ? `${Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB` : "Allegato salvato"}</small></div>
          <div className="btn-group attachment-type-selector" role="group" aria-label={`Tipo di ${attachment.originalName}`}>{typeOptions.map(option => <button type="button" key={option.value} className={currentType === option.value ? "is-selected" : ""} onClick={() => setExistingTypes(current => ({...current, [attachment.id]: option.value}))}><span aria-hidden="true">{option.icon}</span>{option.label}</button>)}</div>
          <button className="btn btn-sm btn-danger attachment-remove-button" type="button" onClick={() => setRemovedIds(current => [...current, attachment.id])}>🗑 Elimina</button>
        </div>;
      })}
      {files.map((file, index) => {
        const currentType = fileTypes[index] ?? "DOCUMENT";
        return <div className="card attachment-type-item" key={`${file.name}-${file.size}-${index}`}>
          <input type="hidden" name="attachmentTypes" value={currentType}/>
          <div className="attachment-type-item-heading"><span aria-hidden="true">＋</span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small></div>
          <div className="btn-group attachment-type-selector" role="group" aria-label={`Tipo di ${file.name}`}>{typeOptions.map(option => <button type="button" key={option.value} className={currentType === option.value ? "is-selected" : ""} onClick={() => setFileTypes(current => current.map((value, itemIndex) => itemIndex === index ? option.value : value))}><span aria-hidden="true">{option.icon}</span>{option.label}</button>)}</div>
          <button className="btn btn-sm btn-danger attachment-remove-button" type="button" onClick={() => removeFile(index)}>🗑 Elimina</button>
        </div>;
      })}
      {error ? <p className="inline-warning full">{error}</p> : null}
    </div>
  </details>;
}
