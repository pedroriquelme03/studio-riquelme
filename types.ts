
export interface Service {
  id: number;
  name: string;
  price: number;
  duration: number; // in minutes
  description: string;
  // opcional: profissional responsável
  responsibleProfessionalId?: string | null;
  responsibleProfessionalName?: string | null;
}

export interface Client {
  name: string;
  phone: string;
  email: string;
  notes?: string;
}

export interface Booking {
  services: Service[];
  date: Date;
  time: string;
  client: Client;
}
