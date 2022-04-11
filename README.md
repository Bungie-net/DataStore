[![NPM version][npm-version-image]][npm-url]
[![MIT License][license-image]][license-url]

Howdy Ren!

# DataStore

**DataStore** is a simple and intuitive isomorphic state management system, built in and optimized for TypeScript, with React integration.

## Installation

`yarn install @bungie/datastore`

or

`npm install @bungie/datastore`

## Why DataStore?

Why use DataStore instead of the other state management solutions? Well, when we looked at our state management needs, a few goals surfaced:

1. **Intuitive**: The simplest, clearest usage pattern should also be the easiest one. Other state management solutions require significant boilerplate - DataStore minimizes that.
2. **Type-safe**: Not only should typing be enforced, it should infer as much as possible. Writing types manually contradicts goal #1.
3. **Lightweight**: Most state managment amounts to setting and changing individual properties. Assuming patterns beyond that accomplishes little. DataStore is very extensible for more divergent patterns, but covers most use-cases out of the box.
4. **Decentralized**: Rather than having one large, centralized store created from many segments, DataStore is decentralized, and depedencies between individual stores are managed manually by those stores. This is useful for sites composed of independent pieces rather than monolithic architectures, although DataStore functions perfectly well in either scenario.

# How to

## Create a DataStore

DataStores can be created by extending the `DataStore` class and creating instances or singletons that way, or
by using the `getDataStoreBuilder<TPayloadType>().build()` method described below.

### Functional Components

```typescript
import {getDataStoreBuilder} from "./DataStore";

interface TodoItem
{
	label: string;
	checked: boolean;
}

interface TodoDataStorePayload
{
	items: TodoItem[];
}

const myTodos = getDataStoreBuilder<TodoDataStorePayload>().build({
	actions: {
		add: (state, label: string) => ({
			items: [...state.items, {
				label,
				checked: false
			}]
		}),
		remove: (state, label: string) => ({
			items: state.items.filter(i => i.label === label)
		}),
		toggle: (state, label: string) => ({
			items: state.items.map(item => (item.label === label)
				? {...item, checked: !item.checked}
				: item
			)
		})
	},
	initialState: {
		items: []
	}
});

```


### Class components

```typescript
import {DataStore} from "./index";

interface TodoItem
{
	label: string;
	checked: boolean;
}

interface TodoDataStorePayload
{
	items: TodoItem[];
}

class TodoDataStore extends DataStore<TodoDataStorePayload>
{
	constructor()
	{
		// Pass initial data to the super
		super({
			items: []
		});
	}

	public actions = this.createActions({
		add: (state, label: string) => ({
			items: [...state.items, {
				label,
				checked: false
			}]
		}),
		remove: (state, label: string) => ({
			items: state.items.filter(i => i.label === label)
		}),
		toggle: (state, label: string) => ({
			items: state.items.map(item => (item.label === label)
				? {...item, checked: !item.checked}
				: item
			)
		})
	});
}

const myTodos = new TodoDataStore();
```

## Observing

### Functional Components

The easiest way of using a DataStore instance in a functional component is the `useDataStore` hook. This hook
automatically observes the instance and destroys the observer when the component unmounts.

```typescript jsx
import {useDataStore} from "@bungie/datastore";
import {UserDataStore} from "./UserDataStore";

export const MyComponent: React.FC = () =>
{
	const userData = useDataStore(UserDataStore);

	return (
		<div>Hi, {userData.username}!</div>
	);
}
```

### Class Components

When using a DataStore instance in a class component, the instance data must be added to state. The most common pattern
is to subscribe to the instance on `componentDidMount` and then destroy the subscription on `componentWillUnmount`.


#### Using the `withDataStore()` HOC

```typescript jsx
import {UserDataStore, UserDataStorePayload} from "./UserDataStore";
import {withDataStore} from "@bungie/datastore/WithDataStore";

interface Props extends UserDataStorePayload
{
}

class MyComponent extends React.Component<Props>
{
	public render()
	{
		return (
			<div>Hi, {this.props.username}!</div>
		)
	}
}

export default withDataStore(UserDataStore, MyComponent)
```

#### Manually subscribing / destroying
```typescript jsx
import {UserDataStore, UserDataStorePayload} from "./UserDataStore";
import {DestroyCallback} from "@bungie/datastore/Broadcaster";

interface MyComponentState
{
	userData: UserDataStorePayload;
}

class MyComponent extends React.Component<{}, MyComponentState>
{
	private destroyUserDataStoreObserver: DestroyCallback;

	constructor(props: {})
	{
		super(props);

		this.state = {
			userData: UserDataStore.state
		}
	}

	public componentDidMount()
	{
		this.destroyUserDataStoreObserver = UserDataStore.observe(userData =>
		{
			this.setState({userData});
		});
	}

	public componentWillUnmount()
	{
		this.destroyUserDataStoreObserver();
	}

	public render()
	{
		return (
			<div>Hi, {this.state.userData.username}!</div>
		)
	}
}
```

## Custom Observer Props

For some use cases, it may be desirable to provide extra data for observers in a DataStore, perhaps to filter out which
observers are updated for a particular data change, or other modifications.

If these are required, you may specify the `propsRequired` boolean in the constructor.

### Example:

#### DataStore Creation

```typescript jsx
import {DataStore} from "@bungie/datastore";
import {getDataStoreBuilder} from "./DataStore";

interface Payload
{
	value: number;
}

interface ObserverProps
{
	shouldUpdate: (value: number) => boolean;
}

class _ClickCountDataStore extends DataStore<Payload, ObserverProps>
{
	public static Instance = new ClickCountDataStore();
	
	constructor()
	{
		super({
			value: 0
		}, {propsRequired: true});
	}
	
	public actions = this.createActions({
       increment: (state) => state.value + 1 
    });

	public override getObserversToUpdate(data: Payload)
	{
		return this.allObservers.filter(observer => observer.params.shouldUpdate(data.value))
	}
}

export const {ClickCountDataStore} = _ClickCountDataStore.Instance;
```

#### Usage

```typescript jsx
import {useDataStore} from "@bungie/datastore";
import isPrime from "prime-number";
import {ClickCountDataStore} from "./ClickCountDataStore";

const PrimeClickCountDisplay: React.FC = () =>
{
	// Only update when the value is even
	const clickData = useDataStore(ClickCountDataStore, {
		shouldUpdate: value => isPrime(value)
	});

	const [primeCount, setPrimeCount] = useState(0);

	useEffect(() =>
	{
		setPrimeCount(primeCount + 1);
	}, [clickData.value]);

	return (
		<div>In {clickData.value} clicks, we hit prime numbers {primeCount} times!</div>
	)
}
```

## Custom Observer Instance

You can create a custom observer instance if you want it to do specific things when data is updated.

### Example

```typescript jsx
import {BroadcasterObserver} from "@bungie/datastore";
import {getDataStoreBuilder} from "./DataStore";

/**
 * Log a message every time an update happens
 */
class LoggerObserver<TDataType, TInputType = any> extends BroadcasterObserver<TDataType, TInputType>
{
	constructor(callback: (newData: TDataType) => void, params: TInputType)
	{
		super(callback, params);
	}

	public update(newData: TDataType)
	{
		console.log("Observer updated: ", newData);

		return super.update(newData);
	}
}

interface UserDataStorePayload
{
	username: string | null;
	id: number | null;
}

const UserDataStore = getDataStoreBuilder<UserDataStorePayload>().build({
    initialState: {
		username: null,
        id: null
    },
    actions: {
		loadUser: async () => {
			const userData = Api.loadUser();
			
			return {
				username: userData.username,
                id: userData.userId
            };
        }
    }
})
```

[npm-url]: https://npmjs.org/package/@bungie/datastore
[npm-version-image]: https://img.shields.io/npm/v/@bungie/datastore.svg?style=flat

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: LICENSE
