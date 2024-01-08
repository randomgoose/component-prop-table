/** @jsx figma.widget.h */

import { TextField } from "./components/TextField";
import { Button, Divider, Switch, Tag } from "../node_modules/fidget-ui/dist";
import { IconComponent, PropertyIcons } from "./icons";

const { widget } = figma
const { useSyncedState, usePropertyMenu, AutoLayout, Text, SVG, Span, Fragment, useWidgetId } = widget

const styles: { [key: string]: AutoLayoutProps | TextProps } = {
  td: {
    padding: { vertical: 8, horizontal: 16 },
    verticalAlignItems: "center",
    height: 32
  },
  variant: {
    fill: "#171717",
    padding: { vertical: 2, horizontal: 6 },
    cornerRadius: 4
  },
  variantText: {
    fontSize: 12,
    fill: "#fff"
  },

}

const COMPONENT_COLS = [
  "propertyName",
  "description",
  "type",
  "variantOptions",
  // "preferredValues"
]

const ISNTANCE_COLS = [
  "propertyName",
  "value"
]

enum MenuProperty {
  CLEAR = "CLEAR",
  LAYOUT = "LAYOUT",
  UPDATE = "UPDATE",
  EXPORT_TYPE_DEFINITIONS = "EXPORT_TYPE_DEFINITIONS",
  ADD_CUSTOM_PROPERTY = "ADD_CUSTOM_PROPERTY",
  REORDER = "REORDER"
}

enum ComponentType {
  COMPONENT = "COMPONENT",
  COMPONENT_SET = "COMPONENT_SET",
  INSTANCE = "INSTANCE"
}

type Component = {
  name: string;
  key: string;
  componentPropertyDefinitions: ComponentPropertyDefinitions;
  type: ComponentType.COMPONENT | ComponentType.COMPONENT_SET
} | {
  name: string;
  key: string;
  id: string;
  componentProperties: ComponentProperties;
  type: ComponentType.INSTANCE
}


function Widget() {
  const [layout, setLayout] = useSyncedState<string>("layout", "default");
  const [component, set] = useSyncedState<Component>("component", { name: "", key: "", componentPropertyDefinitions: {}, type: ComponentType.COMPONENT })
  const [sorter, setSorter] = useSyncedState<string[]>("sorter", [])

  const widgetId = useWidgetId();

  const clear = () => {
    set({ name: "", key: "", componentPropertyDefinitions: {}, type: ComponentType.COMPONENT })
  }

  const filteredCols =
    component.type === ComponentType.INSTANCE
      ? ISNTANCE_COLS
      : layout === "default"
        ? COMPONENT_COLS
        : COMPONENT_COLS.filter(col => col === "propertyName" || col === "type")

  if (component.type === ComponentType.INSTANCE) {
    const { componentProperties, name, key, id, type } = component

    usePropertyMenu(
      [
        { propertyName: MenuProperty.CLEAR, itemType: "action", tooltip: "Clear" },
        { propertyName: MenuProperty.UPDATE, itemType: "action", tooltip: "Update" },
      ],
      async e => {
        switch (e.propertyName) {
          case MenuProperty.CLEAR:
            clear()
            break
          case MenuProperty.UPDATE:
            const node = figma.getNodeById(id);
            if (node && node.type === "INSTANCE" && node.mainComponent) {
              set({
                name: node.name,
                id: node.id,
                key: node.mainComponent?.key,
                type: ComponentType.INSTANCE,
                componentProperties: node.componentProperties
              })
            } else {
              figma.notify("The instance node seems missing.")
            }
            break
        }
      }
    )

  } else {
    const { componentPropertyDefinitions, name, key, type } = component
    if (componentPropertyDefinitions && name && key) {
      usePropertyMenu(
        [
          { propertyName: MenuProperty.CLEAR, itemType: "action", tooltip: "Clear" },
          { propertyName: MenuProperty.LAYOUT, itemType: "dropdown", tooltip: "Layout", options: [{ label: "Default", option: "default" }, { label: "Compact", option: "compact" }], selectedOption: layout },
          { propertyName: MenuProperty.UPDATE, itemType: "action", tooltip: "Update" },
          { propertyName: MenuProperty.EXPORT_TYPE_DEFINITIONS, itemType: "action", tooltip: "Export Type Definitions" },
          { propertyName: MenuProperty.REORDER, itemType: "action", tooltip: "Reorder" }
          // { propertyName: MenuProperty.ADD_CUSTOM_PROPERTY, itemType: "action", tooltip: "Add Custom Property" }
        ],
        async (e) => {
          switch (e.propertyName) {
            case MenuProperty.CLEAR:
              clear()
              break
            case MenuProperty.LAYOUT:
              e.propertyValue && setLayout(e.propertyValue)
              break
            case MenuProperty.UPDATE:
              if (key && type) {
                if (type === ComponentType.COMPONENT_SET) {
                  const componentSet = await figma.importComponentSetByKeyAsync(key);
                  set(prev => ({ ...prev, componentPropertyDefinitions: componentSet.componentPropertyDefinitions, name: componentSet.name }))

                } else if (type === ComponentType.COMPONENT) {
                  const component = await figma.importComponentByKeyAsync(key);
                  set(prev => ({ ...prev, componentPropertyDefinitions: component.componentPropertyDefinitions }));
                }
              }
              break
            case MenuProperty.EXPORT_TYPE_DEFINITIONS:
              return new Promise(() => {
                const node = figma.getNodeById(widgetId);

                const descriptionEntries = Object.entries((node as WidgetNode).widgetSyncedState).filter(([key]) => key.startsWith("text")).map(([key, value]) => [key.replace("text/", ""), value]);
                const descriptions = Object.fromEntries(descriptionEntries);

                figma.showUI(__html__, { visible: false });
                figma.ui.postMessage({ type: "EXPORT_TYPE_DEFINITIONS", payload: { name, componentPropertyDefinitions, descriptions } })
              })
            case MenuProperty.REORDER:
              return new Promise(() => {
                figma.showUI(__html__)
                if (componentPropertyDefinitions) {
                  figma.ui.postMessage({
                    type: 'REORDER',
                    payload: Object.entries(componentPropertyDefinitions).map(([name]) => name).sort((a, b) => sorter.indexOf(a) - sorter.indexOf(b))
                  })
                }
              })
            default:
              break
          }
        }
      )
    }
  }


  const setComponent = () => {
    const node = figma.currentPage.selection[0];

    const setComponentNode = (node: ComponentNode) => {
      if (node.parent?.type === "COMPONENT_SET") {
        set({ name: node.parent.name, key: node.parent.key, type: ComponentType.COMPONENT_SET, componentPropertyDefinitions: node.parent.componentPropertyDefinitions })
      } else {
        set({ name: node.name, key: node.key, type: ComponentType.COMPONENT, componentPropertyDefinitions: node.componentPropertyDefinitions })
      }
    }

    if (node) {
      if (node.type === ComponentType.COMPONENT) {
        setComponentNode(node);
      }
      else if (node.type === ComponentType.COMPONENT_SET) {
        set({ name: node.name, key: node.key, type: ComponentType.COMPONENT_SET, componentPropertyDefinitions: node.componentPropertyDefinitions })
      } else if (node.type === "INSTANCE") {
        const component = node.mainComponent;
        if (component) setComponentNode(component)
      } else {
        figma.notify("Please select a component, a component set or an instance.")
      }
    }
  }

  const setInstance = () => {
    const node = figma.currentPage.selection[0];

    if (node && node.type === "INSTANCE" && node.mainComponent) {
      set({
        name: node.name,
        id: node.id,
        key: node.mainComponent.key,
        type: ComponentType.INSTANCE,
        componentProperties: node.componentProperties
      })
    }

    else {
      figma.notify("Please select an instance.")
    }
  }

  const table = <AutoLayout name="Table Container" direction={"vertical"} spacing={12}>
    <AutoLayout verticalAlignItems={"center"} spacing={8} padding={{ left: 16 }}>
      <SVG src={IconComponent} width={16} height={16} />
      <Text fontWeight={"bold"} fill={"#8638E5"}>{component.name}</Text>
    </AutoLayout>
    <AutoLayout name="Table">
      {filteredCols.map((col) => (
        <AutoLayout key={col} name={"Column"} direction={"vertical"}>
          <AutoLayout {...styles.td} name="Column Header Cell">
            <Text fontSize={12} textCase={"title"} fontWeight={"bold"}>{col.split(/(?=[A-Z])/).join(" ").toLowerCase()}</Text>
          </AutoLayout>

          {
            component.type === ComponentType.INSTANCE
              ?
              Object.entries(component.componentProperties).map(([propertyName, { value, type }]) => {
                let content: FigmaDeclarativeNode;

                switch (col) {
                  case "propertyName":
                    content = <Text fontSize={12} fontWeight={"bold"}>{propertyName.split("#")[0]}</Text>
                    break
                  case "value":
                    switch (type) {
                      case "BOOLEAN":
                        content = <Switch id={propertyName} colorScheme="neutral" checked={Boolean(value)} size="sm" />
                        break
                      case "VARIANT":
                        content = <Tag fill={"#171717"} size="sm" variant="solid">{String(value)}</Tag>
                        // content = <Text fontSize={12}>{String(value)}</Text>
                        break
                      case "INSTANCE_SWAP":
                        content = <SVG src={PropertyIcons["INSTANCE_SWAP"]} />
                        break
                      case "TEXT":
                        content = <SVG src={PropertyIcons["TEXT"]} />
                        break
                    }
                    break
                }

                return (
                  <AutoLayout {...styles.td} name={"Table Cell"} spacing={4} key={propertyName} >
                    {content}
                  </AutoLayout>
                )
              })

              : Object.entries(component.componentPropertyDefinitions).map(([propertyName, { type, variantOptions, defaultValue }]) => {
                let content: FigmaDeclarativeNode;
                switch (col) {
                  case "propertyName":
                    content = <Text fontSize={12} fontWeight={"bold"}>{propertyName.split("#")[0]}</Text>
                    break
                  case "type":
                    content = layout === "default" ?
                      <Fragment>
                        <SVG src={PropertyIcons[type]} />
                        <Text textCase="title" fontSize={12}>{type.toLocaleLowerCase()}</Text>
                      </Fragment> :
                      <Fragment>
                        {
                          type === "VARIANT"
                            ?
                            <Text fontSize={12}>{variantOptions?.map(option => (option === "true" || option === "false") ? option : `'${option}'`).join(" | ")}</Text>
                            :
                            <Fragment>
                              <SVG src={PropertyIcons[type]} />
                              <Text textCase="title" fontSize={12}>{type.toLocaleLowerCase()}</Text>
                            </Fragment>
                        }
                      </Fragment>
                    break
                  case "variantOptions":
                    if (variantOptions && variantOptions.length > 0) {
                      content = <Fragment>
                        {variantOptions.map(option => (
                          <AutoLayout {...styles.variant} key={option}>
                            <Text {...styles.variantText}>{option === defaultValue ? <Span fill={{ r: 1, g: 1, b: 1, a: 0.75 }}>default=</Span> : null}{option}</Text>
                          </AutoLayout>
                        ))}
                      </Fragment>
                    } else {
                      content = <Text>-</Text>
                    }
                    break
                  case "description":
                    content = <TextField id={propertyName} key={propertyName} />
                    break
                }

                return (
                  <AutoLayout {...styles.td} name={"Table Cell"} spacing={4} key={propertyName} >
                    {content}
                  </AutoLayout>
                )
              })
          }
        </AutoLayout>
      ))}
    </AutoLayout>
  </AutoLayout>

  const prompt = <Fragment>
    <Text fill={"#78716c"} width={160} horizontalAlignText={"center"} fontSize={12} lineHeight={20}>Select a component, component set or instance.</Text>

    <Button size="sm" onClick={setComponent}>Create Prop Table</Button>

    <Divider>Or</Divider>

    <Text fill={"#78716c"} width={160} horizontalAlignText={"center"} fontSize={12} lineHeight={20}>Select an instance.</Text>
    <Button size="sm" variant="outline" onClick={setInstance}>Create Instance Table</Button>
  </Fragment>

  return (
    <AutoLayout
      name={"Component Prop Table"}
      horizontalAlignItems={'center'}
      spacing={8}
      padding={72}
      cornerRadius={8}
      fill={'#FFFFFF'}
      stroke={'#E6E6E6'}
      direction={"vertical"}
    >
      {(component.key && component.type) ? table : prompt}
      {/* <AutoLayout> */}
      {/* <Text>Add</Text> */}
      {/* </AutoLayout> */}
    </AutoLayout>
  )
}

widget.register(Widget)
