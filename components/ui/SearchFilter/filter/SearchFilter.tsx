import { useState } from 'react';
import { FILTER_SELECT_ONCHANGE_1, FILTER_SELECT_ONCHANGE_2, FILTER_SELECT_ONCHANGE_3 } from 'config/const'
import Multiselect from 'multiselect-react-dropdown';
import { useSelector, useDispatch } from 'react-redux'
import { Option } from '../../../../utils/interface'

interface multiselectFilterProps {
    filterOptions: Option[],
    itemOrder: number
}

export const SearchFilter = (props: multiselectFilterProps) => {
    const dispatch = useDispatch();
    const handleOnSelect = (selectedList: []) => {
        const { itemOrder } = props;
        switch (itemOrder) {
            case 1:
                dispatch({
                    type: FILTER_SELECT_ONCHANGE_1,
                    payload: selectedList
                })
                break;
            case 2:
                dispatch({
                    type: FILTER_SELECT_ONCHANGE_2,
                    payload: selectedList
                })
                break;
            case 3:
                dispatch({
                    type: FILTER_SELECT_ONCHANGE_3,
                    payload: selectedList
                })
                break;
            default:
                break;
        }
    }

    return (
        <Multiselect
            className='multiSelect'
            options={props.filterOptions}
            showCheckbox
            displayValue="name"
            onSelect={(selectedList: [], selectedItem: any) => {
                handleOnSelect(selectedList);
            }}
        />
    );
}
