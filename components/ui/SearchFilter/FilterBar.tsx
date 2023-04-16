import { SearchFilter } from "./filter/SearchFilter";
// import './FilterBar.css';
import { multiselectFilterProps } from '../../../utils/interface'

interface propsType {
    filterOptions: multiselectFilterProps
}

export const FilterBar = (props: propsType) => {
    return (
        <div className="filterBar">
            <span>Area of interest:</span>
            <SearchFilter filterOptions={props.filterOptions.Interest}  itemOrder={1}/>
            <span>Canton:</span>
            <SearchFilter filterOptions={props.filterOptions.Canton}  itemOrder={2}/>
            <span>Commune:</span>
            <SearchFilter filterOptions={props.filterOptions.Commune}  itemOrder={3}/>
        </div>
    );
}
