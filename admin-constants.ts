import { Booking } from './types';
import { MOCK_SERVICES } from './constants';

export const MOCK_BOOKINGS: Booking[] = [
    {
        services: [MOCK_SERVICES[2]],
        date: new Date(new Date().setDate(new Date().getDate() + 1)),
        time: '10:00',
        client: {
            name: 'Carlos Silva',
            phone: '(11) 98765-4321',
            email: 'carlos.silva@example.com',
        },
    },
    {
        services: [MOCK_SERVICES[0], MOCK_SERVICES[1]],
        date: new Date(new Date().setDate(new Date().getDate() + 1)),
        time: '11:30',
        client: {
            name: 'Fernando Costa',
            phone: '(21) 91234-5678',
            email: 'fernando.costa@example.com',
        },
    },
    {
        services: [MOCK_SERVICES[3]],
        date: new Date(new Date().setDate(new Date().getDate() + 2)),
        time: '14:00',
        client: {
            name: 'Bruno Almeida',
            phone: '(31) 99999-8888',
            email: 'bruno.almeida@example.com',
            notes: 'Pele sensível, usar produto específico.',
        },
    },
    {
        services: [MOCK_SERVICES[5]],
        date: new Date(new Date().setDate(new Date().getDate() + 2)),
        time: '16:00',
        client: {
            name: 'Ricardo Pereira (filho)',
            phone: '(41) 98877-6655',
            email: 'ricardo.pereira@example.com',
        },
    },
];
