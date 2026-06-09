import { useCallback, useState } from 'react';

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const dialogProps = state
    ? {
        open: true,
        title: state.title,
        message: state.message,
        confirmLabel: state.confirmLabel,
        cancelLabel: state.cancelLabel,
        variant: state.variant,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      }
    : {
        open: false,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      };

  return { confirm, dialogProps };
}
