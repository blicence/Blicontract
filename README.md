shema

tr [iş akışı](doc/akis.md)
en [workflow](doc/workflow.md)

 
 
![fl.png](https://github.com/blicence/Blicontract/blob/main/draw/fl.png?raw=true)

 

![factory.svg](https://github.com/blicence/Blicontract/blob/main/draw/factory.svg?raw=)
 
tr [iş akışı](doc/akis.md)
en [workflow](doc/workflow.md)

 

producer

 Our aim is to enable small and medium-sized providers to easily offer their services to end users using blockchain technology, in specific quantities or time periods.

Our goal is to create a structure where small and medium-sized producers or service providers can easily and seamlessly offer their services to end users in certain periods or quantities via the blockchain.

Producers want to offer their services to end users in the form of specific plans. With the developed application, they will be able to create plans according to the appropriate plan type they choose. They will be able to use these plans through our application or through their own applications for end users to access these services.

In the developed structure, when the producer or service provider registers on the application, it creates a contract that it owns and admin this contract . This contract can be controlled as multisig if desired.

The plans that can be created canbe defined in 3 different types for now. These are Nusage, vesting, and api.

Nusage: Defines a usage right for a service with a service fee per use. The usage right has no time limit except for the expiry time specified in the plan.

VestingApi: Used to schedule a service to start at a specified future time. If permission to use the service is granted, it allows usage during the specified interval.

ApiUsage: It ensures that the user pays the service fee to the provider at regular intervals (e.g., hourly, daily, monthly) as they receive the service. The user can cancel the service at any time.

An NFT is created for the user who creates any of these plan types, containing information about that plan. Additionally, the user can sign "to use their own plan for n times, etc." to work offline. This signature will be visible as a QR code, which will redirect to a unique page. Through this link, the user can access offline functionality.

Example uses:

Gym Subscription: A gym can offer a $10 per month plan to customers. Once purchased, the service is activated and payments flow automatically from the user's account to the gym's account. No need to renew membership unless the service is cancelled. Users can verify their membership by signing in to the app. They have the option to terminate the service anytime.

Subscriber card: A café can offer a special plan for regular customers. Under this plan, they can enjoy a 20% discount on coffee when they purchase 15 units or more per month. With the purchase of this plan, they receive 15 usage rights. These rights can be used through the app whenever they visit the café.

Online education applications: A person or organization that provides online training can plan the trainings they will provide at certain dates and time intervals through their own application. When the time comes for these planned trainings, a fee flow can be planned from the person receiving the service to the address of the person providing the training. In this way, the trainer and the recipient overcome the problems related to pricing against the training given mutually.

Museum Card: A common card can be created for all museums in a country, for example.

Mobile and desktop application licensing

Events

Concerts

