import { useEffect, useState, useRef, useCallback, useId } from 'react';

const TextInput = ({ caption, id, type, value, valueChanged }) => {
    // const id = useId();
    return (
        <div
            className='text-input-cont' >

            <input
                type="text"
                id={id}
                name={id}
                placeholder=" "
                value={value}
                onChange={(e) => valueChanged(id, e.target.value)}
            />
            <label htmlFor={id}>{caption}</label>
        </div>
    )
}


export default TextInput