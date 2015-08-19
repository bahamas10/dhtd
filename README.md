dhtd
====

Daemon to manage reading DHT temperature sensors on an interval

Summary
-------

This daemon polls the temperature and humidity data on an interval (30 seconds
by default), and exposes the information over an HTTP interface.

The DHT sensors for reading temperature data on the Raspberry Pi (Linux)
require precise timing that the kernel can't often guarantee.  As such,
the Adafruit Python DHT Library has baked into it a lot of retry and backoff
logic.

To minimize the chance of losing the race with multiple instances of the
DHT sensor gathering scripts running simultaneously, this daemon aims to be
the single source of truth for the DHT sensor.

Example
-------

Create a simple config

``` json
{
  "web": {
    "host": "127.0.0.1",
    "port": 10333
  },
  "dht": {
    "type": 22,
    "pin": 17
  },
  "interval": 30,
  "sudo": true,
  "stats": true
}
```

- `web` configures how the HTTP server is setup
- `dht` tells this program what kind of DHT sensor you are polling (11, 22, or 2302) and what gpio pin it is on
- `interval` is time in seconds to sleep between readings
- `sudo` whether to call the python script with `sudo`, defaults to true
- `stats` expose stats (hostname, node version, dhtd version) over `/stats`, defaults to true

And start the program with the config

    $ dhtd config.json
    2015-08-17T19:08:47.496Z calling: sudo /home/dave/dev/dhtd/_dht.py 22 17
    2015-08-17T19:08:57.428Z success: {"fahrenheit": 77.71999931335449, "celsius": 25.399999618530273, "humidity": 45.599998474121094}
    2015-08-17T19:08:57.583Z server started: http://127.0.0.1:10333
    2015-08-17T19:08:58.924Z 127.0.0.1 GET /data
    2015-08-17T19:09:04.294Z 127.0.0.1 GET /data.json

Human readable data is available at `GET /data`

    $ curl -sS localhost:10333/data
    fahrenheit: 77.72F
    celsius: 25.40C
    humidity: 45.60%
    reading: 2015-08-17T19:08:57.421Z

And json data at `GET /data.json`

    $ curl -sS localhost:10333/data.json | json
    {
      "fahrenheit": 77.71999931335449,
      "celsius": 25.399999618530273,
      "humidity": 45.599998474121094,
      "reading": "2015-08-17T19:08:57.421Z"
    }

Notes
-----

The daemon will wait until an initial reading of the sensor is taking before
bringing up the HTTP server.  Afterwards, any failures will be recorded in
the logs (stdout), but requests to `/data` and `/data.json` will have the
last previous successful reading data.  This is why the `reading` property
exists to see when the last successful reading was.

Index
-----

`GET /` will result in an index page that shows a thermometer graphic with the current
reading that updates every 30 seconds.

![screenshot](/screenshots/index.png)

Installation
------------

### Adafruit Python DHT Library

This program depends on the [Adafruit Python DHT Library](https://github.com/adafruit/Adafruit_Python_DHT)
in order to work properly - you can install it with:

    sudo apt-get update
    sudo apt-get install -y build-essential python-dev
    mkdir -p ~/dev
    git clone git://github.com/adafruit/Adafruit_Python_DHT ~/dev/Adafruit_Python_DHT
    cd ~/dev/Adafruit_Python_DHT
    sudo python setup.py install

### Node.js

Node version 8 or higher

    npm install -g dhtd

Alternatives
------------

- https://github.com/larsks/dhtd - uses a socket file for communication - requires the daemon itself run as root

License
-------

MIT License
