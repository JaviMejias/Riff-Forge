import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { EditChordModalContent } from './EditChordModalContent';

const MySwal = withReactContent(Swal);

export const openEditChordModal = (chordToEdit: string, onReplace: (oldChord: string, newChord: string) => void) => {
  MySwal.fire({
    html: <EditChordModalContent 
            chordToEdit={chordToEdit} 
            onClose={() => MySwal.close()}
            onReplace={(o, n) => {
              MySwal.close();
              onReplace(o, n);
            }} 
          />,
    showConfirmButton: false,
    width: 600,
    background: '#18181b',
    color: '#f4f4f5',
    customClass: {
      popup: 'border border-white/10 rounded-2xl sm:rounded-3xl !p-4 sm:!p-6 overflow-hidden flex flex-col',
      htmlContainer: '!m-0 !text-left'
    }
  });
};
