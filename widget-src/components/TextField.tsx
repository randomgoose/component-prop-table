/** @jsx figma.widget.h */

const { widget } = figma
const { Input, useSyncedState } = widget

export function TextField({ id }: { id: string }) {
    const [value, setValue] = useSyncedState(`text/${id}`, "")
    return <Input value={value} onTextEditEnd={e => setValue(e.characters)} placeholder={"add description..."} fontSize={12} />
}