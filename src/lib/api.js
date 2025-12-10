import axios from 'axios';

export const reservePod = (reservedBy = null, metadata = {}) =>
  axios.post(`/api/reserve`, { reserved_by: reservedBy, metadata })
       .then(r => r.data);

export const confirmPod = (reservationId) =>
  axios.post(`/api/confirm`, { reservation_id: reservationId })
       .then(r => r.data);

export const releasePod = (reservationId) =>
  axios.post(`/api/release`, { reservation_id: reservationId })
       .then(r => r.data);
