'use client';

export default function IncomeEntityDeleteForm({
  id,
  kind,
  name,
  action
}: {
  id: number;
  kind: 'channel';
  name: string;
  action: (formData: FormData) => void;
}) {
  return <form
    action={action}
    className="category-settings-delete-form"
    onSubmit={event => {
      if (!window.confirm(`Rimuovere il canale "${name}"?`)) event.preventDefault();
    }}
  >
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="kind" value={kind} />
    <button className="btn btn-xs btn-danger" type="submit">Rimuovi</button>
  </form>;
}
