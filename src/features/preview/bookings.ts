// Isolated UI fixtures. No writes or reads to the studio's business collections.
export const previewBookings = [
  { id: 'BK-001', clientName: 'Rina Amelia', sessionName: 'Sesi Family', packageName: 'Paket Gold', time: '09:00', total: 2500000, paid: 750000, status: 'confirmed' },
  { id: 'BK-002', clientName: 'Toko Sinar Jaya', sessionName: 'Foto Produk', packageName: 'Paket Silver', time: '13:00', total: 1500000, paid: 0, status: 'pending' },
  { id: 'BK-003', clientName: 'Budi & Sari', sessionName: 'Prewedding', packageName: 'Paket Platinum', time: '16:00', total: 5000000, paid: 1500000, status: 'confirmed' },
] as const;
