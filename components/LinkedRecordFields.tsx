import type {ReactNode} from 'react';

/** Keep the form's direct-child layout intact when linked records are read-only. */
export default function LinkedRecordFields({locked, children}: {locked: boolean; children: ReactNode}) {
    return locked
        ? <fieldset className="form-section-stack" disabled style={{border: 0, margin: 0, minWidth: 0}}>{children}</fieldset>
        : <div className="form-section-stack">{children}</div>;
}
