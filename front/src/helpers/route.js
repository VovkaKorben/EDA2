import { API_URL } from './utils.js';
// 1. берем черепашку,считаем границы
// 2. берем текст, считаем точку 2.5мм вверх+вниз, расширяем
// 3. опционально - ещё расширяем на 1-2мм, чтобы не впритык было
// 4. на выходе - прямоугольник для размещения

const loadPackages = async (packageIds, errors) => {

    const resp = await fetch(`${API_URL}packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify([...packageIds])
    });
    const result = await resp.json();
    // return elem_data;
    if (!(resp.ok && result.success)) {
        errors.push('error fetch data while loading packages');
        return;
    }
    return result;
};

export const doRoute = async (schemaElements, libElements, errors) => {
    // check all components has package
    const packageIds = new Set();
    const packagesAssigned = Object.values(schemaElements.elements).every(elem => {
        const packageId = elem.package;

        const packageAssigned = packageId !== null;
        if (packageAssigned)
            packageIds.add(parseInt( packageId,10));
        else
            errors.push(`No package assigned for `);
        return packageAssigned;
    });
    if (!packagesAssigned) return;

    const packages =await loadPackages(packageIds, errors);
console.log(packages);
}






















const data =
{
    "schemaElements": {"elements":{"0":{"id":0,"typeId":3,"pos":[76,46],"rotate":0,"typeIndex":1,"package":"9"},"1":{"id":1,"typeId":13,"pos":[67,35],"rotate":0,"typeIndex":1,"package":"20"},"2":{"id":2,"typeId":18,"pos":[58,42],"rotate":0,"typeIndex":1,"package":"11"}},"wires":{"0":{"wireId":0,"source":{"type":"PIN","elementId":0,"pinIdx":"B"},"target":{"type":"TCONN","pos":[70,46]},"path":[[73,46],[70,46]]},"1":{"wireId":1,"source":{"type":"PIN","elementId":1,"pinIdx":"PIN2"},"target":{"type":"TCONN","pos":[63,42]},"path":[[65,35],[63,35],[63,42]]},"2":{"wireId":2,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN2"},"target":{"type":"TCONN","pos":[63,42]},"path":[[62,42],[63,42]]},"3":{"wireId":3,"source":{"type":"TCONN","pos":[63,42]},"target":{"type":"TCONN","pos":[63,46]},"path":[[63,42],[63,46]]},"4":{"wireId":4,"source":{"type":"PIN","elementId":1,"pinIdx":"PIN1"},"target":{"type":"TCONN","pos":[70,40]},"path":[[70,46],[70,40]]},"5":{"wireId":5,"source":{"type":"TCONN","pos":[70,46]},"target":{"type":"TCONN","pos":[70,40]},"path":[[69,35],[70,35],[70,40]]},"6":{"wireId":6,"source":{"type":"PIN","elementId":0,"pinIdx":"C"},"target":{"type":"TCONN","pos":[70,40]},"path":[[77,43],[77,40],[70,40]]},"7":{"wireId":7,"source":{"type":"TCONN","pos":[70,46]},"target":{"type":"TCONN","pos":[67,46]},"path":[[70,46],[67,46]]},"8":{"wireId":8,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN1"},"target":{"type":"TCONN","pos":[58,46]},"path":[[58,45],[58,46]]},"9":{"wireId":9,"source":{"type":"TCONN","pos":[63,46]},"target":{"type":"TCONN","pos":[58,46]},"path":[[63,46],[58,46]]},"10":{"wireId":10,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN3"},"target":{"type":"TCONN","pos":[58,46]},"path":[[54,42],[53,42],[53,46],[58,46]]},"11":{"wireId":11,"source":{"type":"TCONN","pos":[63,46]},"target":{"type":"TCONN","pos":[67,46]},"path":[[63,46],[67,46]]},"12":{"wireId":12,"source":{"type":"PIN","elementId":0,"pinIdx":"E"},"target":{"type":"TCONN","pos":[67,46]},"path":[[77,49],[77,50],[67,50],[67,46]]}}},
    "libElements": {"1":{"typeId":1,"abbr":"R","descr":"A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.","name":"resistor","turtle":[[{"code":"R","params":[-5,-2,10,4]},{"code":"L","params":[-10,0,-5,0]},{"code":"L","params":[5,0,10,0]}],[{"code":"R","params":[2,-5,-4,10]},{"code":"L","params":[0,-10,0,-5]},{"code":"L","params":[0,5,0,10]}],[{"code":"R","params":[5,2,-10,-4]},{"code":"L","params":[10,0,5,0]},{"code":"L","params":[-5,0,-10,0]}],[{"code":"R","params":[-2,5,4,-10]},{"code":"L","params":[0,10,0,5]},{"code":"L","params":[0,-5,0,-10]}]],"pins":[{"0":[-10,0],"1":[10,0]},{"0":[0,-10],"1":[0,10]},{"0":[10,0],"1":[-10,0]},{"0":[0,10],"1":[0,-10]}],"bounds":[[-10,-2,10,2],[-2,-10,2,10],[-10,-2,10,2],[-2,-10,2,10]]},"2":{"typeId":2,"abbr":"C","descr":"A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material","name":"capacitor","turtle":[[{"code":"L","params":[-1,-4,-1,4]},{"code":"L","params":[1,-4,1,4]},{"code":"L","params":[-6,0,-1,0]},{"code":"L","params":[1,0,6,0]}],[{"code":"L","params":[4,-1,-4,-1]},{"code":"L","params":[4,1,-4,1]},{"code":"L","params":[0,-6,0,-1]},{"code":"L","params":[0,1,0,6]}],[{"code":"L","params":[1,4,1,-4]},{"code":"L","params":[-1,4,-1,-4]},{"code":"L","params":[6,0,1,0]},{"code":"L","params":[-1,0,-6,0]}],[{"code":"L","params":[-4,1,4,1]},{"code":"L","params":[-4,-1,4,-1]},{"code":"L","params":[0,6,0,1]},{"code":"L","params":[0,-1,0,-6]}]],"pins":[{"0":[-6,0],"1":[6,0]},{"0":[0,-6],"1":[0,6]},{"0":[6,0],"1":[-6,0]},{"0":[0,6],"1":[0,-6]}],"bounds":[[-6,-4,6,4],[-4,-6,4,6],[-6,-4,6,4],[-4,-6,4,6]]},"3":{"typeId":3,"abbr":"VT","descr":"A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.","name":"transistor","turtle":[[{"code":"L","params":[-11,0,-2,0]},{"code":"L","params":[-2,-4,-2,4]},{"code":"L","params":[2,10.66,2,5.66]},{"code":"L","params":[2,-5.66,2,-10.66]},{"code":"C","params":[0,0,6]},{"code":"L","params":[-2,-1.748,2,-5.66]},{"code":"P","params":[-2,1.749,0.122,2.456,-1.292,3.87,2]},{"code":"L","params":[-2,1.749,2,5.66]}],[{"code":"L","params":[0,-11,0,-2]},{"code":"L","params":[4,-2,-4,-2]},{"code":"L","params":[-10.66,2,-5.66,2]},{"code":"L","params":[5.66,2,10.66,2]},{"code":"C","params":[0,0,6]},{"code":"L","params":[1.748,-2,5.66,2]},{"code":"P","params":[-1.749,-2,-2.456,0.122,-3.87,-1.292,2]},{"code":"L","params":[-1.749,-2,-5.66,2]}],[{"code":"L","params":[11,0,2,0]},{"code":"L","params":[2,4,2,-4]},{"code":"L","params":[-2,-10.66,-2,-5.66]},{"code":"L","params":[-2,5.66,-2,10.66]},{"code":"C","params":[0,0,6]},{"code":"L","params":[2,1.748,-2,5.66]},{"code":"P","params":[2,-1.749,-0.122,-2.456,1.292,-3.87,2]},{"code":"L","params":[2,-1.749,-2,-5.66]}],[{"code":"L","params":[0,11,0,2]},{"code":"L","params":[-4,2,4,2]},{"code":"L","params":[10.66,-2,5.66,-2]},{"code":"L","params":[-5.66,-2,-10.66,-2]},{"code":"C","params":[0,0,6]},{"code":"L","params":[-1.748,2,-5.66,-2]},{"code":"P","params":[1.749,2,2.456,-0.122,3.87,1.292,2]},{"code":"L","params":[1.749,2,5.66,-2]}]],"pins":[{"B":[-11,0],"E":[2,10.66],"C":[2,-10.66]},{"B":[0,-11],"E":[-10.66,2],"C":[10.66,2]},{"B":[11,0],"E":[-2,-10.66],"C":[-2,10.66]},{"B":[0,11],"E":[10.66,-2],"C":[-10.66,-2]}],"bounds":[[-11,-10.66,6,10.66],[-10.66,-11,10.66,6],[-6,-10.66,11,10.66],[-10.66,-6,10.66,11]]},"4":{"typeId":4,"abbr":"VD","descr":"A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.","name":"diode","turtle":[[{"code":"P","params":[-2.5,-2.5,2.5,0,-2.5,2.5,1]},{"code":"L","params":[-7.5,0,7.5,0]},{"code":"L","params":[2.5,2.5,2.5,-2.5]}],[{"code":"P","params":[2.5,-2.5,0,2.5,-2.5,-2.5,1]},{"code":"L","params":[0,-7.5,0,7.5]},{"code":"L","params":[-2.5,2.5,2.5,2.5]}],[{"code":"P","params":[2.5,2.5,-2.5,0,2.5,-2.5,1]},{"code":"L","params":[7.5,0,-7.5,0]},{"code":"L","params":[-2.5,-2.5,-2.5,2.5]}],[{"code":"P","params":[-2.5,2.5,0,-2.5,2.5,2.5,1]},{"code":"L","params":[0,7.5,0,-7.5]},{"code":"L","params":[2.5,-2.5,-2.5,-2.5]}]],"pins":[{"A":[-7.5,0],"C":[7.5,0]},{"A":[0,-7.5],"C":[0,7.5]},{"A":[7.5,0],"C":[-7.5,0]},{"A":[0,7.5],"C":[0,-7.5]}],"bounds":[[-7.5,-2.5,7.5,2.5],[-2.5,-7.5,2.5,7.5],[-7.5,-2.5,7.5,2.5],[-2.5,-7.5,2.5,7.5]]},"5":{"typeId":5,"abbr":"test","descr":"test","name":"test","turtle":[[],[],[],[]],"pins":[{},{},{},{}],"bounds":[[null,null,null,null],[null,null,null,null],[null,null,null,null],[null,null,null,null]]}},
    "saved": {"elements":{"0":{"id":0,"typeId":3,"pos":[76,46],"rotate":0,"typeIndex":1,"package":"9"},"1":{"id":1,"typeId":13,"pos":[67,35],"rotate":0,"typeIndex":1,"package":"20"},"2":{"id":2,"typeId":18,"pos":[58,42],"rotate":0,"typeIndex":1,"package":"11"}},"wires":{"0":{"wireId":0,"source":{"type":"PIN","elementId":0,"pinIdx":"B"},"target":{"type":"TCONN","pos":[70,46]},"path":[[73,46],[70,46]]},"1":{"wireId":1,"source":{"type":"PIN","elementId":1,"pinIdx":"PIN2"},"target":{"type":"TCONN","pos":[63,42]},"path":[[65,35],[63,35],[63,42]]},"2":{"wireId":2,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN2"},"target":{"type":"TCONN","pos":[63,42]},"path":[[62,42],[63,42]]},"3":{"wireId":3,"source":{"type":"TCONN","pos":[63,42]},"target":{"type":"TCONN","pos":[63,46]},"path":[[63,42],[63,46]]},"4":{"wireId":4,"source":{"type":"PIN","elementId":1,"pinIdx":"PIN1"},"target":{"type":"TCONN","pos":[70,40]},"path":[[70,46],[70,40]]},"5":{"wireId":5,"source":{"type":"TCONN","pos":[70,46]},"target":{"type":"TCONN","pos":[70,40]},"path":[[69,35],[70,35],[70,40]]},"6":{"wireId":6,"source":{"type":"PIN","elementId":0,"pinIdx":"C"},"target":{"type":"TCONN","pos":[70,40]},"path":[[77,43],[77,40],[70,40]]},"7":{"wireId":7,"source":{"type":"TCONN","pos":[70,46]},"target":{"type":"TCONN","pos":[67,46]},"path":[[70,46],[67,46]]},"8":{"wireId":8,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN1"},"target":{"type":"TCONN","pos":[58,46]},"path":[[58,45],[58,46]]},"9":{"wireId":9,"source":{"type":"TCONN","pos":[63,46]},"target":{"type":"TCONN","pos":[58,46]},"path":[[63,46],[58,46]]},"10":{"wireId":10,"source":{"type":"PIN","elementId":2,"pinIdx":"PIN3"},"target":{"type":"TCONN","pos":[58,46]},"path":[[54,42],[53,42],[53,46],[58,46]]},"11":{"wireId":11,"source":{"type":"TCONN","pos":[63,46]},"target":{"type":"TCONN","pos":[67,46]},"path":[[63,46],[67,46]]},"12":{"wireId":12,"source":{"type":"PIN","elementId":0,"pinIdx":"E"},"target":{"type":"TCONN","pos":[67,46]},"path":[[77,49],[77,50],[67,50],[67,46]]}}},
    "view": {"zoomIndex":7,"zoom":8,"interval":20,"x":49.77083333333335,"y":23.26666666666668}
}
const sch = data.schemaElements;
const lib = data.libElements;
const err = [];
doRoute(sch, lib, err);