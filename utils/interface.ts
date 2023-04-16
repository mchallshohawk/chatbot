export interface Option {
    name: string,
    id: number
}

export interface multiselectFilterProps {
    Interest : Option[],
    Canton : Option[],
    Commune : Option[]
}