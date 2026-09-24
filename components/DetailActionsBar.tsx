import {Children, cloneElement, Fragment, isValidElement, type ReactNode} from 'react';
import DetailActionsMenu from './DetailActionsMenu';

function inlineActions(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(inlineActions);
  if (!isValidElement<{className?: string; children?: ReactNode}>(node)) return node;
  if (node.type === Fragment) return cloneElement(node, {}, inlineActions(node.props.children));
  const className = node.props.className;
  if (!className?.split(/\s+/).includes('btn-option')) return node;
  return cloneElement(node, {className: className.replace(/\bbtn-option\b/g, 'btn-default')});
}

function actionItems(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap(child =>
    isValidElement<{children?: ReactNode}>(child) && child.type === Fragment
      ? actionItems(child.props.children)
      : [child]
  );
}

export default function DetailActionsBar({primary, secondary, controls}: {
  primary: ReactNode;
  secondary?: ReactNode;
  controls?: ReactNode;
}) {
  const actions = actionItems(primary);
  return <div className="detail-actions-bar" data-primary-count={actions.length} data-has-secondary={Boolean(secondary)}>
    {controls ? <div className="detail-actions-controls">{controls}</div> : null}
    <div className="detail-actions-inline">{actions.map((action, index) =>
      <div className="detail-action-item" key={index}>{inlineActions(action)}</div>
    )}</div>
    <DetailActionsMenu desktop={Boolean(secondary)}>
      <div className="detail-actions-mobile-primary">{actions.map((action, index) =>
        <div className="detail-action-item" key={index}>{action}</div>
      )}</div>
      {secondary}
    </DetailActionsMenu>
  </div>;
}
