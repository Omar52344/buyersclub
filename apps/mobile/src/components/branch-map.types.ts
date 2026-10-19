export interface MapBranch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isOpen: boolean;
}

export interface BranchMapProps {
  branches: MapBranch[];
  onSelect?: (id: string) => void;
  height?: number;
}
