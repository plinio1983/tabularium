'use client';

type Props = {
  id: number;
  name: string;
  action: (formData: FormData) => void;
};

export default function CategoryDeleteForm({ id, name, action }: Props) {
  return <form
    action={action}
    className="category-settings-delete-form"
    onSubmit={(event) => {
      if (!window.confirm(`Rimuovere la categoria "${name}"? Le spese collegate resteranno senza categoria.`)) {
        event.preventDefault();
      }
    }}
  >
    <input type="hidden" name="id" value={id} />
    <button type="submit" className="table-action danger-action">Rimuovi</button>
  </form>;
}
