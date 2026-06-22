export interface MeasurementSystemCardProps {
  theme: 'light' | 'dark';
  measurementSystem: 'metric' | 'imperial';
  setMeasurementSystem: (value: 'metric' | 'imperial') => void;
}
