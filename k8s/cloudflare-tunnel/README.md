# Cloudflare Tunnel

This directory deploys `cloudflared` into the MicroK8s cluster. Argo CD manages
the Deployment, but the tunnel token is intentionally created out-of-band and
is never committed to Git.

## Create the token Secret

Create a remotely managed tunnel in Cloudflare Zero Trust, copy its token, and
run this on the server without putting the token in the repository or chat:

```bash
microk8s kubectl create namespace cloudflare-tunnel
microk8s kubectl -n cloudflare-tunnel create secret generic cloudflare-tunnel-token \
  --from-literal=token='<CLOUDFLARE_TUNNEL_TOKEN>'
```

The Argo CD application will create the namespace if it does not exist. The
Secret must exist before `cloudflared` can become Ready.

## Configure the public hostname

In Cloudflare Tunnel, add a published application for the QA hostname and
route it to the MicroK8s ingress controller. Add a separate published
application for Argo CD and protect it with Cloudflare Access.

The tunnel connects the cluster to Cloudflare; it does not replace Kubernetes
Ingress or Argo CD.
