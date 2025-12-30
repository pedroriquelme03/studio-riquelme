
import { Service } from './types';

export const MOCK_SERVICES: Service[] = [
  {
    id: 1,
    name: 'Haircut',
    price: 35,
    duration: 30,
    description: 'Classic men\'s haircut, tailored to your style. Includes a wash and style.',
  },
  {
    id: 2,
    name: 'Beard Trim',
    price: 20,
    duration: 20,
    description: 'Expert beard shaping, trimming, and line-up with a straight razor finish.',
  },
  {
    id: 3,
    name: 'Haircut + Beard',
    price: 50,
    duration: 50,
    description: 'The full package. A precision haircut and a meticulous beard trim.',
  },
  {
    id: 4,
    name: 'Hot Towel Shave',
    price: 40,
    duration: 30,
    description: 'A luxurious traditional hot towel shave for the closest, smoothest finish.',
  },
  {
    id: 5,
    name: 'Eyebrow Shaping',
    price: 15,
    duration: 10,
    description: 'Clean up and shape your eyebrows for a polished look.',
  },
  {
    id: 6,
    name: 'Kids Haircut (Under 12)',
    price: 25,
    duration: 25,
    description: 'A patient and stylish haircut for the little gentleman.',
  },
];

export const BARBERSHOP_NAME = "The Dapper Cut";
