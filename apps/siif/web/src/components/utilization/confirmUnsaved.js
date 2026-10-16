// ─── Unsaved-changes prompt ───────────────────────────────────────────────────
// One SweetAlert shared by every "you're about to leave" path, so they all look
// and behave the same. Resolves to 'save' | 'leave' | 'stay'.

import Swal from 'sweetalert2';

const isDark = () => document.documentElement.classList.contains('dark');

/** @param {{ canSave?: boolean }} options canSave=false hides "Save & leave" (e.g. over allocation) */
export async function confirmUnsaved({ canSave = true } = {}) {
    const dark = isDark();
    const result = await Swal.fire({
        icon: 'warning',
        title: 'You have unsaved changes',
        text: canSave
            ? 'Your utilization edits haven\'t been saved yet. Save them before leaving?'
            : 'Your utilization edits haven\'t been saved and can\'t be saved yet. Leaving will discard them.',
        showConfirmButton: canSave,
        confirmButtonText: 'Save & leave',
        showDenyButton: true,
        denyButtonText: 'Leave without saving',
        showCancelButton: true,
        cancelButtonText: 'Stay on page',
        reverseButtons: true,
        focusCancel: true,
        allowOutsideClick: true,
        background: dark ? '#0f172a' : '#ffffff',
        color: dark ? '#e2e8f0' : '#0f172a',
        iconColor: '#f59e0b',
        confirmButtonColor: '#059669',
        denyButtonColor: '#e11d48',
        cancelButtonColor: dark ? '#334155' : '#08315F',
        customClass: {
            popup: 'siif-swal-popup',
            title: 'siif-swal-title',
            htmlContainer: 'siif-swal-text',
            actions: 'siif-swal-actions',
        },
    });
    if (result.isConfirmed) return 'save';
    if (result.isDenied) return 'leave';
    return 'stay';
}
