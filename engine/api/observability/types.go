package observability

import (
	"github.com/ovh/cds/sdk"
)

// Attributes recorded on the span for the requests.
// Only trace exporters will need them.
const (
	HostAttribute       = "http.host"
	MethodAttribute     = "http.method"
	PathAttribute       = "http.path"
	UserAgentAttribute  = "http.user_agent"
	StatusCodeAttribute = "http.status_code"
)

// Configuration is the global tracing configuration
type Configuration struct {
	Enable   bool `json:"enable"`
	Exporter struct {
		Jaeger struct {
			HTTPCollectorEndpoint string `toml:"HTTPCollectorEndpoint" default:"http://localhost:14268" json:"httpCollectorEndpoint"`
		} `json:"jaeger"`
		Prometheus struct {
			ReporteringPeriod int `toml:"ReporteringPeriod" default:"10" json:"reporteringPeriod"`
		} `json:"prometheus"`
	} `json:"exporter"`
	SamplingProbability float64 `json:"samplingProbability"`
	Name                string  `toml:"name" default:"cdsinstance" comment:"Name of this CDS Instance. This value is added to /mon/metrics as label on each series" json:"name"`
}

//Options is the options struct for a new tracing span
type Options struct {
	Init     bool
	Name     string
	Enable   bool
	User     *sdk.User
	Worker   *sdk.Worker
	Hatchery *sdk.Service
	SpanKind int
}
